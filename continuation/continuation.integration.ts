import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

// Set the database path before loading modules that initialise the singleton DB.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindlaxy-continuation-"));
process.env.CORE_DB_PATH = path.join(tempDir, "continuation-test.db");

const { db, initDB } = require("../db/sqlite") as typeof import("../db/sqlite");
const {
  createArtifact,
  createTransformation,
  getArtifactGenealogy,
  recordDecision,
  reenter,
} = require("./continuation.service") as typeof import("./continuation.service");

function run(): void {
  initDB();

  const sourceContent = "Original source text. This content must never be overwritten.";

  createArtifact(
    {
      id: "A",
      type: "text",
      content: sourceContent,
      status: "source",
      metadata: { test: true },
    },
    "integration-test"
  );

  createTransformation(
    {
      id: "T1",
      sourceIds: ["A"],
      targetType: "text",
      preserve: ["semantic_core", "imagery"],
      vary: ["rhythm", "form"],
      avoid: ["meaning_reversal"],
      allowLoss: ["original_meter"],
      instruction: "Create lyric continuations.",
      adapter: "integration-test",
    },
    [
      { id: "B", type: "text", content: "Variant B", status: "variant" },
      { id: "C", type: "text", content: "Variant C", status: "variant" },
      { id: "D", type: "text", content: "Variant D", status: "variant" },
    ],
    "integration-test-generator"
  );

  recordDecision("C", "SELECT", "human-test", "Chosen continuation");

  reenter(
    "C",
    {
      id: "T2",
      targetType: "text",
      preserve: ["semantic_core"],
      vary: ["voice"],
      avoid: [],
      allowLoss: [],
      instruction: "Continue selected variant.",
      adapter: "integration-test",
    },
    [
      { id: "E", type: "text", content: "Re-entry E", status: "variant" },
      { id: "F", type: "text", content: "Re-entry F", status: "variant" },
    ],
    "human-test"
  );

  const source = db.prepare("SELECT * FROM artifacts WHERE id = 'A'").get() as any;
  assert.equal(source.content, sourceContent, "source A must remain unchanged");
  assert.equal(source.status, "source", "source A must remain a source");

  const firstGeneration = db
    .prepare("SELECT artifact_id FROM variants WHERE transform_id = 'T1' ORDER BY ordinal")
    .all() as Array<{ artifact_id: string }>;
  assert.deepEqual(
    firstGeneration.map((row) => row.artifact_id),
    ["B", "C", "D"],
    "T1 must create three distinct variants"
  );
  assert.equal(new Set(firstGeneration.map((row) => row.artifact_id)).size, 3);

  const selected = db.prepare("SELECT status FROM artifacts WHERE id = 'C'").get() as any;
  assert.equal(selected.status, "selected", "C must be selected");

  const selectDecision = db
    .prepare("SELECT actor FROM decisions WHERE artifact_id = 'C' AND decision = 'SELECT'")
    .get() as any;
  assert.equal(selectDecision.actor, "human-test", "selection must be attributed to the human actor");

  const reentryDecision = db
    .prepare("SELECT id FROM decisions WHERE artifact_id = 'C' AND decision = 'REENTER'")
    .get();
  assert.ok(reentryDecision, "C must carry an explicit REENTER decision");

  const secondGeneration = db
    .prepare("SELECT artifact_id FROM variants WHERE transform_id = 'T2' ORDER BY ordinal")
    .all() as Array<{ artifact_id: string }>;
  assert.deepEqual(secondGeneration.map((row) => row.artifact_id), ["E", "F"]);

  for (const child of ["E", "F"]) {
    const transformed = db
      .prepare(
        `SELECT id FROM artifact_relations
         WHERE from_artifact_id = ? AND to_artifact_id = 'C' AND type = 'TRANSFORMED_FROM'`
      )
      .get(child);
    assert.ok(transformed, `${child} must be transformed from C`);

    const reentryRelation = db
      .prepare(
        `SELECT id FROM artifact_relations
         WHERE from_artifact_id = ? AND to_artifact_id = 'C' AND type = 'REENTRY_OF'`
      )
      .get(child);
    assert.ok(reentryRelation, `${child} must carry REENTRY_OF C`);
  }

  const genealogy = getArtifactGenealogy("C");
  const childIds = new Set(
    (genealogy.children as Array<any>).map((row) => row.from_artifact_id)
  );
  assert.ok(childIds.has("E") && childIds.has("F"), "genealogy must expose E and F as descendants of C");

  const traceEvents = (genealogy.traces as Array<any>).map((row) => row.event);
  assert.ok(traceEvents.includes("DECISION_SELECT"), "trace must include selection");
  assert.ok(traceEvents.includes("DECISION_REENTER"), "trace must include re-entry");
  assert.ok(traceEvents.includes("TRANSFORMATION_CREATED"), "trace must include transformation history");

  const traceCount = db.prepare("SELECT COUNT(*) AS count FROM traces").get() as { count: number };
  assert.ok(traceCount.count >= 5, "ledger must contain the complete operation history");

  console.log("Continuation Core integration test passed: SOURCE -> VARIANTS -> SELECT -> RE-ENTRY");
}

try {
  run();
} finally {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
