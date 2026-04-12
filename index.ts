import { NodeService } from './memory/node.service';
import { SearchService } from './memory/search.service';
import { embed } from './embedding/embed';
import { autoLink } from './graph/auto-link';
import { db } from './db/sqlite';
import { Node } from './types';

/**
 * High-level function to add a new thought (node) to the knowledge core.
 * It handles persisting the node, generating a semantic embedding, storing
 * the embedding, finding similar nodes and linking them.
 *
 * Returns the created node and the similar nodes for optional display.
 */
export async function addThought(node: Node): Promise<{ node: Node; similar: Array<{ node_id: string; score: number }> }> {
  const nodeService = new NodeService();
  const searchService = new SearchService();

  // 1. Persist the node
  nodeService.create(node);

  // 2. Compute embedding vector for the content
  const vector = await embed(node.content);
  
  // 3. Store vector in embeddings table (serialize to Buffer)
  const buffer = Buffer.from(Float32Array.from(vector).buffer);
  db.prepare(
    `INSERT INTO embeddings (node_id, vector, model, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(node.id, buffer, 'text-embedding-3-small', Date.now());

  // 4. Search for similar existing nodes
  const similar = searchService.findSimilar(vector);

  // 5. Auto link to similar nodes above threshold
  autoLink(node.id, similar);

  return { node, similar };
}