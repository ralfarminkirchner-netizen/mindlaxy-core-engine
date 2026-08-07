import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { addThought } from '../index';
import { NodeService } from '../memory/node.service';
import { RelationService } from '../memory/relation.service';
import { embed } from '../embedding/embed';
import { SearchService } from '../memory/search.service';
import { Artifact, DecisionType, Node, TransformSpec } from '../types';
import { initDB } from '../db/sqlite';
import {
  createArtifact,
  createTransformation,
  getArtifactGenealogy,
  recordDecision,
  reenter,
} from '../continuation/continuation.service';

initDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, core: 'continuation-v0.1' });
});

// ---------------------------------------------------------------------------
// Legacy knowledge-core API
// ---------------------------------------------------------------------------

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

app.get('/node/:id', (req, res) => {
  const service = new NodeService();
  const node = service.get(req.params.id);
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  res.json(node);
});

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

app.get('/related/:id', (req, res) => {
  const id = req.params.id;
  const relationService = new RelationService();
  const outgoing = relationService.getOutgoing(id);
  const incoming = relationService.getIncoming(id);
  res.json({ outgoing, incoming });
});

// ---------------------------------------------------------------------------
// Continuation Core v0.1 API
// ---------------------------------------------------------------------------

/**
 * Register a source or externally-created artifact. INSERT-only by design:
 * reusing an existing id fails instead of overwriting the original.
 */
app.post('/artifact', (req, res) => {
  try {
    const body = req.body as Partial<Artifact> & { actor?: string };
    if (!body.type || !body.status) {
      return res.status(400).json({ error: 'Missing required fields: type and status' });
    }

    const artifact: Artifact = {
      id: body.id || randomUUID(),
      type: body.type,
      uri: body.uri,
      content: body.content,
      metadata: body.metadata,
      rights: body.rights,
      status: body.status,
    };

    const created = createArtifact(artifact, body.actor || 'human');
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Create one transformation and register its generated candidates as distinct
 * variant artifacts. The caller may currently be a manual adapter or an LLM;
 * provider-specific generation is intentionally outside the v0.1 kernel.
 */
app.post('/transform', (req, res) => {
  try {
    const { spec, variants, actor } = req.body as {
      spec?: TransformSpec;
      variants?: Artifact[];
      actor?: string;
    };

    if (!spec || !Array.isArray(spec.sourceIds) || spec.sourceIds.length === 0) {
      return res.status(400).json({ error: 'spec.sourceIds must contain at least one artifact id' });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'variants must contain at least one generated artifact' });
    }

    const normalizedSpec: TransformSpec = {
      ...spec,
      id: spec.id || randomUUID(),
      preserve: spec.preserve || [],
      vary: spec.vary || [],
      avoid: spec.avoid || [],
      allowLoss: spec.allowLoss || [],
    };

    const normalizedVariants = variants.map((variant) => ({
      ...variant,
      id: variant.id || randomUUID(),
      status: 'variant' as const,
    }));

    const result = createTransformation(
      normalizedSpec,
      normalizedVariants,
      actor || 'generator'
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/artifact/:id/decision', (req, res) => {
  try {
    const { decision, actor, note } = req.body as {
      decision?: DecisionType;
      actor?: string;
      note?: string;
    };
    if (!decision) {
      return res.status(400).json({ error: 'Missing decision' });
    }
    const result = recordDecision(req.params.id, decision, actor || 'human', note);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Explicit Re-Entry: an existing artifact is used as a source for a new
 * transformation. Parent artifacts are never modified or merged.
 */
app.post('/artifact/:id/reenter', (req, res) => {
  try {
    const { spec, variants, actor } = req.body as {
      spec?: Omit<TransformSpec, 'sourceIds'> & { sourceIds?: string[] };
      variants?: Artifact[];
      actor?: string;
    };

    if (!spec) return res.status(400).json({ error: 'Missing transform spec' });
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'variants must contain at least one generated artifact' });
    }

    const normalizedSpec = {
      ...spec,
      id: spec.id || randomUUID(),
      preserve: spec.preserve || [],
      vary: spec.vary || [],
      avoid: spec.avoid || [],
      allowLoss: spec.allowLoss || [],
    };

    const normalizedVariants = variants.map((variant) => ({
      ...variant,
      id: variant.id || randomUUID(),
      status: 'variant' as const,
    }));

    const result = reenter(
      req.params.id,
      normalizedSpec,
      normalizedVariants,
      actor || 'human'
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/artifact/:id/genealogy', (req, res) => {
  try {
    res.json(getArtifactGenealogy(req.params.id));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default app;
