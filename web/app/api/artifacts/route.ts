import { apiUser, run } from '@/lib/api';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';
import { readBody, requiredText, text } from '../body';

// Register a new artifact (admin, curator)
export async function POST(req: Request) {
  return run(async () => {
    const user = await apiUser(EDITORS);
    const b = await readBody(req);
    const values = [
      requiredText(b, 'accession_number', 'Accession number'),
      requiredText(b, 'title', 'Title'),
      requiredText(b, 'category', 'Category'),
      text(b, 'material'),
      text(b, 'origin_culture'),
      text(b, 'est_year_from'),
      text(b, 'est_year_to'),
      text(b, 'acquisition_date'),
      text(b, 'current_location'),
      text(b, 'status'),
      text(b, 'description'),
      user.user_id, // created_by always comes from the session, never from the request
    ];
    return withRole(user, async (db) => (await db.query(`
      INSERT INTO artifacts (accession_number, title, category, material, origin_culture,
                             est_year_from, est_year_to, acquisition_date, current_location,
                             status, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6::int, $7::int, $8::date, $9, COALESCE($10, 'in_storage'), $11, $12)
      RETURNING accession_number
    `, values)).rows[0]);
  }, 201);
}
