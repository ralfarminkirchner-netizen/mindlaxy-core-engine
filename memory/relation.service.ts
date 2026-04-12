import { db } from '../db/sqlite';
import crypto from 'crypto';

/**
 * Service for managing relationships between nodes. Relationships form a
 * directed graph describing semantic connections between knowledge items.
 */
export class RelationService {
  /**
   * Create a relationship between two nodes. The `type` parameter describes
   * the nature of the link (e.g. "related", "derived_from") and `strength`
   * expresses confidence in the connection between 0 and 1.
   */
  create(fromId: string, toId: string, type: string, strength: number): void {
    db.prepare(
      `INSERT INTO relationships (id, from_id, to_id, type, strength)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      fromId,
      toId,
      type,
      strength
    );
  }

  /**
   * Retrieve relationships originating from a specific node.
   */
  getOutgoing(fromId: string): Array<{ id: string; to_id: string; type: string; strength: number }> {
    return db.prepare('SELECT id, to_id, type, strength FROM relationships WHERE from_id = ?').all(fromId) as Array<{ id: string; to_id: string; type: string; strength: number }>;
  }

  /**
   * Retrieve relationships pointing to a specific node.
   */
  getIncoming(toId: string): Array<{ id: string; from_id: string; type: string; strength: number }> {
    return db.prepare('SELECT id, from_id, type, strength FROM relationships WHERE to_id = ?').all(toId) as Array<{ id: string; from_id: string; type: string; strength: number }>;
  }
}