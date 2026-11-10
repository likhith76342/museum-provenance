import { apiUser, run } from '@/lib/api';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';
import { readBody, requiredText, text } from '../../../body';

// Transfer ownership through the transfer_ownership procedure (admin, curator).
// The procedure closes the current ownership and opens the new one atomically;
// any error it raises is returned as-is.
export async function POST(req: Request, { params }: { params: Promise<{ accession: string }> }) {
  return run(async () => {
    const user = await apiUser(EDITORS);
    const { accession } = await params;
    const b = await readBody(req);
    const values = [
      accession,
      requiredText(b, 'new_owner_id', 'New owner'),
      requiredText(b, 'transfer_date', 'Transfer date'),
      requiredText(b, 'method', 'Acquisition method'),
      text(b, 'price'),
      text(b, 'currency')?.toUpperCase() ?? null,
      text(b, 'document'),
    ];
    return withRole(user, async (db) => {
      await db.query(
        'CALL transfer_ownership($1::varchar, $2::int, $3::date, $4::varchar, $5::numeric, $6::char(3), $7::text)',
        values,
      );
      return (await db.query(
        'SELECT accession_number, owner_name, held_since FROM v_current_owner WHERE accession_number = $1',
        [accession],
      )).rows[0];
    });
  }, 201);
}
