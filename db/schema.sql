-- Legacy knowledge graph -----------------------------------------------------

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  color TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  strength REAL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS embeddings (
  node_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,
  model TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  node_id TEXT,
  tag TEXT
);

-- Continuation Core v0.1 ----------------------------------------------------
-- Sources are immutable by convention: transformations always create new
-- artifacts. Status changes are decisions about an artifact, never replacement
-- of its content or identity.

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  uri TEXT,
  content TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  rights_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transforms (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  preserve_json TEXT NOT NULL DEFAULT '[]',
  vary_json TEXT NOT NULL DEFAULT '[]',
  avoid_json TEXT NOT NULL DEFAULT '[]',
  allow_loss_json TEXT NOT NULL DEFAULT '[]',
  instruction TEXT,
  adapter TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transform_sources (
  transform_id TEXT NOT NULL,
  source_artifact_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (transform_id, source_artifact_id),
  FOREIGN KEY (transform_id) REFERENCES transforms(id) ON DELETE CASCADE,
  FOREIGN KEY (source_artifact_id) REFERENCES artifacts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS variants (
  artifact_id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE RESTRICT,
  FOREIGN KEY (transform_id) REFERENCES transforms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artifact_relations (
  id TEXT PRIMARY KEY,
  from_artifact_id TEXT NOT NULL,
  to_artifact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (from_artifact_id) REFERENCES artifacts(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_artifact_id) REFERENCES artifacts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  actor TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  inputs_json TEXT NOT NULL DEFAULT '[]',
  outputs_json TEXT NOT NULL DEFAULT '[]',
  transform_id TEXT,
  artifact_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (transform_id) REFERENCES transforms(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transform_sources_artifact
  ON transform_sources(source_artifact_id);
CREATE INDEX IF NOT EXISTS idx_variants_transform
  ON variants(transform_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_artifact_relations_from
  ON artifact_relations(from_artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_relations_to
  ON artifact_relations(to_artifact_id);
CREATE INDEX IF NOT EXISTS idx_decisions_artifact
  ON decisions(artifact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_traces_artifact
  ON traces(artifact_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_traces_transform
  ON traces(transform_id, timestamp);
