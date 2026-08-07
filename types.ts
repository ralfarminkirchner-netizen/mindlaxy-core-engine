/**
 * Legacy knowledge-node types. Kept for backward compatibility with the
 * existing MiNDLAXY knowledge graph and embedding pipeline.
 */
export type NodeType =
  | "sentence"
  | "idea"
  | "philosopher"
  | "exercise"
  | "note";

export interface Node {
  id: string;
  type: NodeType;
  content: string;
  source?: string;
  color?: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * Continuation Core v0.1
 *
 * An Artifact is an addressable state. Files are optional materializations of
 * that state; the artifact identity is not the provider, file, or generator.
 */
export type ArtifactType =
  | "text"
  | "audio"
  | "voice"
  | "song"
  | "image"
  | "video"
  | "world"
  | "3d_object"
  | "app"
  | "code"
  | "document"
  | "data";

export type ArtifactStatus =
  | "source"
  | "variant"
  | "selected"
  | "ratified"
  | "folded"
  | "rejected";

export interface Artifact {
  id: string;
  type: ArtifactType;
  uri?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  rights?: Record<string, unknown>;
  status: ArtifactStatus;
  created_at?: number;
  updated_at?: number;
}

export type RelationType =
  | "DERIVED_FROM"
  | "VARIANT_OF"
  | "TRANSFORMED_FROM"
  | "INSPIRED_BY"
  | "CONTAINS"
  | "REENTRY_OF";

export interface Relation {
  id: string;
  from: string;
  to: string;
  relationType: RelationType;
  metadata?: Record<string, unknown>;
  created_at?: number;
}

/**
 * The executable form of the Mixer: a contract describing what a generator
 * may preserve, vary, avoid, or lose while producing a new artifact state.
 */
export interface TransformSpec {
  id: string;
  sourceIds: string[];
  targetType: ArtifactType;
  preserve: string[];
  vary: string[];
  avoid: string[];
  allowLoss: string[];
  instruction?: string;
  adapter: string;
  created_at?: number;
}

export interface Variant {
  artifactId: string;
  transformId: string;
  ordinal: number;
  status: ArtifactStatus;
}

export type DecisionType =
  | "KEEP"
  | "REJECT"
  | "FOLD"
  | "SELECT"
  | "RATIFY"
  | "REENTER";

export interface Decision {
  id: string;
  artifactId: string;
  decision: DecisionType;
  actor: string;
  note?: string;
  created_at?: number;
}

export interface Trace {
  id: string;
  event: string;
  actor: string;
  timestamp: number;
  inputs: string[];
  outputs: string[];
  transformId?: string;
  artifactId?: string;
  payload?: Record<string, unknown>;
}
