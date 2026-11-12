import { HttpError } from './api';

const EMBED_API_URL = process.env.EMBED_API_URL ?? 'http://localhost:8001';
export const EMBED_DIM = 384;

/** Calls the embedding API. Same model as the seed embeddings (all-MiniLM-L6-v2). */
export async function embedTexts(texts: string[]): Promise<{ model: string; vectors: number[][] }> {
  let res: Response;
  try {
    res = await fetch(`${EMBED_API_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(503, 'The embedding service is not reachable. Start it with: docker compose up -d embed-api');
  }
  if (!res.ok) {
    // FastAPI returns a string for our own 400s but a list for validation (422) errors
    const detail = await res.json().then((d) => (typeof d.detail === 'string' ? d.detail : '')).catch(() => '');
    throw new HttpError(502, `Embedding service error ${res.status} ${detail}`.trim());
  }
  const data = await res.json();
  if (data.dim !== EMBED_DIM) throw new HttpError(502, `Expected ${EMBED_DIM}-d vectors, got ${data.dim}`);
  return { model: data.model, vectors: data.vectors };
}

/** pgvector text format: '[0.1,0.2,...]' (cast with $n::vector in SQL) */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
