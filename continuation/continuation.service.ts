import { randomUUID } from "crypto";
import { db } from "../db/sqlite";
import {
  Artifact,
  Decision,
  DecisionType,
  RelationType,
  Trace,
  TransformSpec,
  Variant,
} from "../types";

function now(): number {
  return Date.now();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function assertArtifactExists(id: string): void {
  const row = db.prepare("SELECT id FROM artifacts WHERE id = ?").get(id);
  if (!row) throw new Error(`Artifact not found: ${id}`);
}

function insertTrace(trace: Trace): void {
  db.prepare(
    `INSERT INTO traces (
      id, event, actor, timestamp, inputs_json, outputs_json,
      transform_id, artifact_id, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    trace.id,
    trace.event,
    trace.actor,
    trace.timestamp,
    JSON.stringify(trace.inputs),
    JSON.stringify(trace.outputs),
    trace.transformId ?? null,
    trace.artifactId ?? null,
    json(trace.payload)
  );
}

export function createArtifact(
  artifact: Artifact,
  actor = "human"
): Artifact {
  const timestamp = now();
  const created = artifact.created_at ?? timestamp;
  const updated = artifact.updated_at ?? created;

  db.prepare(
    `INSERT INTO artifacts (
      id, type, uri, content, metadata_json, rights_json,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    artifact.id,
    artifact.type,
    artifact.uri ?? null,
    artifact.content ?? null,
    json(artifact.metadata),
    json(artifact.rights),
    artifact.status,
    created,
    updated
  );

  insertTrace({
    id: randomUUID(),
    event: "ARTIFACT_CREATED",
    actor,
    timestamp,
    inputs: [],
    outputs: [artifact.id],
    artifactId: artifact.id,
    payload: { status: artifact.status, type: artifact.type },
  });

  return { ...artifact, created_at: created, updated_at: updated };
}

export interface GeneratedVariantInput extends Artifact {
  relationType?: RelationType;
}

export interface TransformationResult {
  transform: TransformSpec;
  variants: Variant[];
  artifacts: Artifact[];
}

function persistTransformation(
  spec: TransformSpec,
  generated: GeneratedVariantInput[],
  actor: string
): TransformationResult {
  if (spec.sourceIds.length === 0) {
    throw new Error("A transformation requires at least one source artifact");
  }

  for (const sourceId of spec.sourceIds) assertArtifactExists(sourceId);

  const timestamp = now();
  const createdAt = spec.created_at ?? timestamp;

  db.prepare(
    `INSERT INTO transforms (
      id, target_type, preserve_json, vary_json, avoid_json,
      allow_loss_json, instruction, adapter, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    spec.id,
    spec.targetType,
    JSON.stringify(spec.preserve),
    JSON.stringify(spec.vary),
    JSON.stringify(spec.avoid),
    JSON.stringify(spec.allowLoss),
    spec.instruction ?? null,
    spec.adapter,
    createdAt
  );

  const sourceStmt = db.prepare(
    `INSERT INTO transform_sources (transform_id, source_artifact_id, ordinal)
     VALUES (?, ?, ?)`
  );
  spec.sourceIds.forEach((sourceId, ordinal) => {
    sourceStmt.run(spec.id, sourceId, ordinal);
  });

  const variants: Variant[] = [];
  const artifacts: Artifact[] = [];

  generated.forEach((candidate, ordinal) => {
    if (candidate.status !== "variant") {
      throw new Error(
        `Generated artifact ${candidate.id} must enter the system with status 'variant'`
      );
    }

    const created = candidate.created_at ?? timestamp;
    const updated = candidate.updated_at ?? created;

    db.prepare(
      `INSERT INTO artifacts (
        id, type, uri, content, metadata_json, rights_json,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      candidate.id,
      candidate.type,
      candidate.uri ?? null,
      candidate.content ?? null,
      json(candidate.metadata),
      json(candidate.rights),
      candidate.status,
      created,
      updated
    );

    db.prepare(
      `INSERT INTO variants (artifact_id, transform_id, ordinal, status)
       VALUES (?, ?, ?, ?)`
    ).run(candidate.id, spec.id, ordinal, candidate.status);

    for (const sourceId of spec.sourceIds) {
      db.prepare(
        `INSERT INTO artifact_relations (
          id, from_artifact_id, to_artifact_id, type, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        candidate.id,
        sourceId,
        candidate.relationType ?? "TRANSFORMED_FROM",
        "{}",
        timestamp
      );
    }

    variants.push({
      artifactId: candidate.id,
      transformId: spec.id,
      ordinal,
      status: candidate.status,
    });
    artifacts.push({ ...candidate, created_at: created, updated_at: updated });
  });

  insertTrace({
    id: randomUUID(),
    event: "TRANSFORMATION_CREATED",
    actor,
    timestamp,
    inputs: spec.sourceIds,
    outputs: artifacts.map((artifact) => artifact.id),
    transformId: spec.id,
    payload: {
      targetType: spec.targetType,
      adapter: spec.adapter,
      preserve: spec.preserve,
      vary: spec.vary,
      avoid: spec.avoid,
      allowLoss: spec.allowLoss,
    },
  });

  return {
    transform: { ...spec, created_at: createdAt },
    variants,
    artifacts,
  };
}

export function createTransformation(
  spec: TransformSpec,
  generated: GeneratedVariantInput[],
  actor = "generator"
): TransformationResult {
  return db.transaction(() => persistTransformation(spec, generated, actor))();
}

export function recordDecision(
  artifactId: string,
  decision: DecisionType,
  actor = "human",
  note?: string
): Decision {
  assertArtifactExists(artifactId);
  const timestamp = now();
  const row: Decision = {
    id: randomUUID(),
    artifactId,
    decision,
    actor,
    note,
    created_at: timestamp,
  };

  db.transaction(() => {
    db.prepare(
      `INSERT INTO decisions (id, artifact_id, decision, actor, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(row.id, artifactId, decision, actor, note ?? null, timestamp);

    const statusByDecision: Partial<Record<DecisionType, string>> = {
      REJECT: "rejected",
      FOLD: "folded",
      SELECT: "selected",
      RATIFY: "ratified",
    };

    const nextStatus = statusByDecision[decision];
    if (nextStatus) {
      db.prepare(
        `UPDATE artifacts SET status = ?, updated_at = ? WHERE id = ?`
      ).run(nextStatus, timestamp, artifactId);
      db.prepare(
        `UPDATE variants SET status = ? WHERE artifact_id = ?`
      ).run(nextStatus, artifactId);
    }

    insertTrace({
      id: randomUUID(),
      event: `DECISION_${decision}`,
      actor,
      timestamp,
      inputs: [artifactId],
      outputs: [artifactId],
      artifactId,
      payload: { note: note ?? null },
    });
  })();

  return row;
}

export function reenter(
  sourceArtifactId: string,
  nextSpec: Omit<TransformSpec, "sourceIds"> & { sourceIds?: string[] },
  generated: GeneratedVariantInput[],
  actor = "human"
): TransformationResult {
  assertArtifactExists(sourceArtifactId);

  return db.transaction(() => {
    const timestamp = now();
    const decisionId = randomUUID();

    db.prepare(
      `INSERT INTO decisions (id, artifact_id, decision, actor, note, created_at)
       VALUES (?, ?, 'REENTER', ?, ?, ?)`
    ).run(
      decisionId,
      sourceArtifactId,
      actor,
      `Re-entered as source for transform ${nextSpec.id}`,
      timestamp
    );

    insertTrace({
      id: randomUUID(),
      event: "DECISION_REENTER",
      actor,
      timestamp,
      inputs: [sourceArtifactId],
      outputs: [sourceArtifactId],
      artifactId: sourceArtifactId,
      payload: { nextTransformId: nextSpec.id },
    });

    const sourceIds = Array.from(
      new Set([sourceArtifactId, ...(nextSpec.sourceIds ?? [])])
    );

    const result = persistTransformation(
      { ...nextSpec, sourceIds },
      generated,
      actor
    );

    for (const artifact of result.artifacts) {
      db.prepare(
        `INSERT INTO artifact_relations (
          id, from_artifact_id, to_artifact_id, type, metadata_json, created_at
        ) VALUES (?, ?, ?, 'REENTRY_OF', ?, ?)`
      ).run(
        randomUUID(),
        artifact.id,
        sourceArtifactId,
        JSON.stringify({ transformId: nextSpec.id }),
        timestamp
      );
    }

    return result;
  })();
}

export function getArtifactGenealogy(artifactId: string): {
  artifact: unknown;
  parents: unknown[];
  children: unknown[];
  decisions: unknown[];
  traces: unknown[];
} {
  assertArtifactExists(artifactId);

  const artifact = db.prepare("SELECT * FROM artifacts WHERE id = ?").get(artifactId);
  const parents = db
    .prepare(
      `SELECT r.*, a.type, a.uri, a.status
       FROM artifact_relations r
       JOIN artifacts a ON a.id = r.to_artifact_id
       WHERE r.from_artifact_id = ?
       ORDER BY r.created_at ASC`
    )
    .all(artifactId);
  const children = db
    .prepare(
      `SELECT r.*, a.type, a.uri, a.status
       FROM artifact_relations r
       JOIN artifacts a ON a.id = r.from_artifact_id
       WHERE r.to_artifact_id = ?
       ORDER BY r.created_at ASC`
    )
    .all(artifactId);
  const decisions = db
    .prepare(
      `SELECT * FROM decisions WHERE artifact_id = ? ORDER BY created_at ASC`
    )
    .all(artifactId);
  const traces = db
    .prepare(
      `SELECT * FROM traces
       WHERE artifact_id = ?
          OR inputs_json LIKE ?
          OR outputs_json LIKE ?
       ORDER BY timestamp ASC`
    )
    .all(artifactId, `%"${artifactId}"%`, `%"${artifactId}"%`);

  return { artifact, parents, children, decisions, traces };
}
