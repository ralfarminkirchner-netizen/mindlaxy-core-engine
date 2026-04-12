import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { addThought } from '../index';
import { NodeService } from '../memory/node.service';
import { RelationService } from '../memory/relation.service';
import { embed } from '../embedding/embed';
import { SearchService } from '../memory/search.service';
import { Node } from '../types';
import { initDB } from '../db/sqlite';

// Initialise database schema on server start
initDB();

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Endpoint to create and store a new node. The request body must contain
 * at minimum the `type` and `content` fields; an `id` will be generated
 * automatically if not provided. Returns the node and any similar nodes.
 */
app.post('/node', async (req, res) => {
  try {
    const body = req.body as Partial<Node>;
    if (!body.content || !body.type) {
      return res.status(400).json({ error: 'Missing required fields: type and content' });
    }
    const node: Node = {
      id: body.id || randomUUID(),
      type: body.type,
      content: body.content,
      source: body.source,
      color: body.color,
    };
    const result = await addThought(node);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Retrieve a node by ID.
 */
app.get('/node/:id', (req, res) => {
  const service = new NodeService();
  const node = service.get(req.params.id);
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  res.json(node);
});

/**
 * Semantic search: given a query text, compute its embedding and return the
 * most similar nodes along with similarity scores.
 */
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing query' });
    }
    const vector = await embed(query);
    const searchService = new SearchService();
    const results = searchService.findSimilar(vector, 10);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get outgoing and incoming relationships for a node.
 */
app.get('/related/:id', (req, res) => {
  const id = req.params.id;
  const relationService = new RelationService();
  const outgoing = relationService.getOutgoing(id);
  const incoming = relationService.getIncoming(id);
  res.json({ outgoing, incoming });
});

export default app;