-- NODES: central table for all types of knowledge items (sentences, ideas, philosophers, exercises, notes)
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  color TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- RELATIONSHIPS: adjacency list modelling semantic links between nodes
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  strength REAL DEFAULT 0.5
);

-- EMBEDDINGS: stores vector representations for nodes used for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
  node_id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,
  model TEXT,
  updated_at INTEGER
);

-- TAGS: optional tagging metadata for nodes
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  node_id TEXT,
  tag TEXT
);