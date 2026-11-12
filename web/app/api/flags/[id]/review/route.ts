import { withRole } from '@/lib/db';
import { apiUser, HttpError, run } from '@/lib/api';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const user = await apiUser(['admin', 'curator']);
    const flagId = Number((await params).id);
    if (!Number.isInteger(flagId) || flagId < 1 || flagId > 2147483647) throw new HttpError(400, 'Invalid flag id');
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? '');
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

    // The reviewer is ALWAYS the session user, never taken from the request body.
    // review_flag() enforces its own rules (final states, notes required, role).
    await withRole(user, (db) =>
      db.query('CALL review_flag($1::int, $2::int, $3::varchar, $4::text)', [flagId, user.user_id, status, notes]),
    );
    return { ok: true };
  });
}
