import { randomUUID } from 'crypto';

/**
 * Generate an embedding for a given text. When the OpenAI API key is
 * available (`process.env.OPENAI_API_KEY`) and the `openai` package is
 * installed, the function will call the OpenAI embeddings API to produce
 * a semantic vector. When the API is unavailable, it falls back to
 * generating a pseudo-random vector seeded by the text. This ensures
 * deterministic results in offline scenarios for testing purposes.
 */
export async function embed(text: string): Promise<number[]> {
  // Try to require the OpenAI client lazily so that installations without
  // the package don't crash. If it fails we use a fallback.
  try {
    const { default: OpenAI } = await import('openai');
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set');
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding as number[];
  } catch (err) {
    // Fallback: deterministic pseudo-random vector based on hash of text.
    // We use the crypto module to produce a 32-byte hash and map to floats.
    const hash = Buffer.from(require('crypto').createHash('sha256').update(text).digest());
    // Convert bytes to floats between -1 and 1; length 32 for simplicity.
    const vector: number[] = [];
    for (let i = 0; i < hash.length; i += 4) {
      const segment = hash.readUInt32BE(i);
      // Map 0..2^32-1 to [-1,1]
      const normalized = (segment / 0xffffffff) * 2 - 1;
      vector.push(normalized);
    }
    return vector;
  }
}