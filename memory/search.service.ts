import { db } from '../db/sqlite';
import { cosine } from '../embedding/vector';

/**
 * Service providing semantic search capabilities over the knowledge core. It
 * retrieves vectors from the embeddings table and computes cosine similarity
 * between a query vector and stored embeddings. Results are sorted by
 * similarity in descending order.
 */
export class SearchService {
  /**
   * Find the most similar nodes given a query embedding. The returned array
   * contains objects with the node identifier and a similarity score. Use
   * the optional `limit` parameter to restrict the number of results.
   */
  findSimilar(queryVector: number[], limit = 10): { node_id: string; score: number }[] {
    const rows = db.prepare('SELECT node_id, vector FROM embeddings').all() as Array<{ node_id: string; vector: Buffer }>;
    const results: { node_id: string; score: number }[] = [];
    for (const row of rows) {
      // Deserialize binary vector into Float32Array. Each embedding row stores a vector as a BLOB.
      const buffer = row.vector;
      // Convert Buffer to Float32Array (assuming little-endian; Node's Buffer uses big-endian for readUInt32 but this is fine because we treat as raw floats)
      const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
      const vec = Array.from(floatArray);
      // Skip invalid rows
      if (vec.length !== queryVector.length) continue;
      const score = cosine(queryVector, vec);
      results.push({ node_id: row.node_id, score });
    }
    // Sort by descending similarity and limit the number of results
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}