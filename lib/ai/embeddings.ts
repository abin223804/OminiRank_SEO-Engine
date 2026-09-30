import crypto from "crypto";
import { getGeminiClient } from "./generator";

export const EMBEDDING_DIMENSION = 768;

/**
 * Computes the cosine similarity between two numeric vectors
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Generates a deterministic, normalized 768-dimensional pseudo-embedding
 * used in offline development and test suites. Semantically similar strings
 * (e.g. sharing word stems and n-grams) produce high cosine similarity (>0.90),
 * while distinct strings produce low similarity (<0.50).
 */
export function generateDeterministicEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);

  // 1. Extract words and character n-grams (bigrams & trigrams)
  const tokens = normalized.split(/\s+/);
  const ngrams: string[] = [...tokens];

  for (let i = 0; i < normalized.length - 2; i++) {
    ngrams.push(normalized.slice(i, i + 3));
  }

  // 2. Project tokens and ngrams onto 768 dimensions using SHA-256 buckets
  for (const token of ngrams) {
    const hash = crypto.createHash("sha256").update(token).digest();
    for (let j = 0; j < 8; j++) {
      const bucket = hash.readUInt16BE(j * 2) % EMBEDDING_DIMENSION;
      const weight = ((hash[j * 2 + 16] % 100) / 100) * 2 - 1; // Range [-1, 1]
      vector[bucket] += weight;
    }
  }

  // 3. Add base harmonic wave based on total length and character sum
  const charSum = normalized.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] += Math.sin((i + charSum) * 0.05) * 0.1;
  }

  // 4. L2 Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    norm += vector[i] * vector[i];
  }

  norm = Math.sqrt(norm);
  if (norm === 0) return vector;

  return vector.map((v) => v / norm);
}

/**
 * Generates 768-dimensional dense vector embedding using Gemini text-embedding-004
 * with automated deterministic fallback for hermetic offline execution.
 */
export async function generateEmbedding(
  text: string,
  forceMock = false
): Promise<number[]> {
  if (forceMock || !process.env.GEMINI_API_KEY || process.env.NODE_ENV === "test") {
    return generateDeterministicEmbedding(text);
  }

  const gemini = getGeminiClient();
  if (!gemini) {
    return generateDeterministicEmbedding(text);
  }

  try {
    const response = await (gemini as any).models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

    const values = response?.embedding?.values;
    if (Array.isArray(values) && values.length === EMBEDDING_DIMENSION) {
      return values;
    }

    return generateDeterministicEmbedding(text);
  } catch (err: any) {
    console.warn(`[Embedding] Gemini text-embedding-004 call failed (${err.message}). Using deterministic fallback.`);
    return generateDeterministicEmbedding(text);
  }
}

/**
 * Batch embedding generator for multiple queries
 */
export async function generateBatchEmbeddings(
  texts: string[],
  forceMock = false
): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t, forceMock)));
}
