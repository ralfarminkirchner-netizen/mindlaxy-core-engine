import { db } from '../db/sqlite';
import { Node } from '../types';

/**
 * Service for CRUD operations on nodes in the SQLite database. Nodes
 * represent individual thoughts, sentences, ideas or other knowledge units.
 */
export class NodeService {
  /**
   * Create a new node in the database. If `created_at` or `updated_at`
   * properties are not provided they will be generated.
   */
  create(node: Node): void {
    const createdAt = node.created_at ?? Date.now();
    const updatedAt = node.updated_at ?? createdAt;
    db.prepare(
      `INSERT INTO nodes (id, type, content, source, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      node.id,
      node.type,
      node.content,
      node.source || null,
      node.color || null,
      createdAt,
      updatedAt
    );
  }

  /**
   * Retrieve a node from the database by its ID.
   */
  get(id: string): Node | undefined {
    return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Node | undefined;
  }

  /**
   * Update the content of an existing node and refresh its updated_at timestamp.
   */
  update(id: string, content: string): void {
    db.prepare(
      `UPDATE nodes SET content = ?, updated_at = ? WHERE id = ?`
    ).run(content, Date.now(), id);
  }
}