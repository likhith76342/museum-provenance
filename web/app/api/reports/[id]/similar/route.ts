import { withRole } from '@/lib/db';
import { apiUser, HttpError, run } from '@/lib/api';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const user = await apiUser(); // all roles, read-only
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new HttpError(400, 'Invalid report id');
    const k = Math.min(Math.max(Number(new URL(req.url).searchParams.get('k')) || 5, 1), 20);
    const rows = await withRole(user, async (db) =>
      (await db.query('SELECT * FROM find_similar_reports($1::int, $2::int)', [id, k])).rows,
    );
    return { report_id: id, results: rows };
  });
}
