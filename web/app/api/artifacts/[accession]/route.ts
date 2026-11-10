import { apiUser, HttpError, run } from '@/lib/api';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';
import { readBody, text } from '../../body';

// Update status and/or location (admin, curator). Blank fields keep their current value.
export async function PATCH(req: Request, { params }: { params: Promise<{ accession: string }> }) {
  return run(async () => {
    const user = await apiUser(EDITORS);
    const { accession } = await params;
    const b = await readBody(req);
    const status = text(b, 'status');
    const location = text(b, 'current_location');
    if (status === null && location === null) throw new HttpError(400, 'Nothing to update');

    const row = await withRole(user, async (db) => (await db.query(`
      UPDATE artifacts
      SET status = COALESCE($2, status), current_location = COALESCE($3, current_location)
      WHERE accession_number = $1
      RETURNING accession_number, status, current_location
    `, [accession, status, location])).rows[0]);
    if (!row) throw new HttpError(404, `Artifact ${accession} does not exist`);
    return row;
  });
}
