import { withRole } from '@/lib/db';
import { apiUser, HttpError, run } from '@/lib/api';
import { embedTexts, toVectorLiteral } from '@/lib/embed';

export async function GET(req: Request) {
  return run(async () => {
    const user = await apiUser(); // all roles, read-only
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const mode = url.searchParams.get('mode') === 'semantic' ? 'semantic' : 'keyword';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), 25);
    if (q.length < 2) throw new HttpError(400, 'Type at least 2 characters');
    if (q.length > 500) throw new HttpError(400, 'Query is too long (max 500 characters)');

    if (mode === 'keyword') {
      // Full-text search (Phase 2): tsvector + GIN index, ranked, snippet with <b> tags
      const rows = await withRole(user, async (db) =>
        (await db.query(
          `SELECT report_id, accession_number, report_date, ROUND(rank::numeric, 4) AS score, snippet
           FROM search_reports($1::text, $2::int)`,
          [q, limit],
        )).rows,
      );
      return { mode, results: rows };
    }

    // Semantic search: embed the query, k-NN over report embeddings (HNSW, cosine)
    const { vectors } = await embedTexts([q]);
    const rows = await withRole(user, async (db) =>
      (await db.query(
        `SELECT cr.report_id, a.accession_number, cr.report_date,
                ROUND((1 - (e.embedding <=> $1::vector))::numeric, 4) AS score,
                LEFT(cr.report_text, 160) AS snippet
         FROM report_embeddings e
         JOIN condition_reports cr ON cr.report_id   = e.report_id
         JOIN artifacts a          ON a.artifact_id  = cr.artifact_id
         ORDER BY e.embedding <=> $1::vector
         LIMIT $2`,
        [toVectorLiteral(vectors[0]), limit],
      )).rows,
    );
    return { mode, results: rows };
  });
}
