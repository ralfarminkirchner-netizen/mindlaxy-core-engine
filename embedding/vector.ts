/**
 * Compute the cosine similarity between two vectors of equal length. The result
 * is a value between -1 and 1, where 1 indicates identical direction.
 *
 * @param a first vector
 * @param b second vector
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}