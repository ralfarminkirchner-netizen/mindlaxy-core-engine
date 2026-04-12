import { RelationService } from '../memory/relation.service';

/**
 * Automatically create relationships based on similarity scores. For each
 * candidate similarity entry above a given threshold, a relationship of
 * type "related" is created from the new node to the similar node. This
 * helper encapsulates the policy for auto-linking and can be extended
 * for more sophisticated rules.
 */
export function autoLink(nodeId: string, similar: Array<{ node_id: string; score: number }>, threshold = 0.78): void {
  const relations = new RelationService();
  for (const item of similar) {
    if (item.score < threshold) continue;
    relations.create(nodeId, item.node_id, 'related', item.score);
  }
}