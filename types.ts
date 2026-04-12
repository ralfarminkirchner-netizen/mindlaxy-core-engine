/**
 * Allowed node types. A node can represent various units of knowledge
 * including simple sentences, ideas, philosophical concepts, exercises
 * or generic notes. This enum is a guide and can be extended.
 */
export type NodeType =
  | "sentence"
  | "idea"
  | "philosopher"
  | "exercise"
  | "note";

/**
 * Data structure representing a single node in the knowledge core.
 * Each node is uniquely identified by an `id` and stores its textual
 * content along with optional metadata such as source and color.
 */
export interface Node {
  id: string;
  type: NodeType;
  content: string;
  source?: string;
  color?: string;
  created_at?: number;
  updated_at?: number;
}