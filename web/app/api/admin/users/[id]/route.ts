import { apiUser, HttpError, run } from '@/lib/api';
import { withRole } from '@/lib/db';
import { readBody, text } from '../../../body';

// Activate/deactivate a user and/or change their role (admin only).
// Deactivation logs the user out at once: app_session_user() checks is_active.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const user = await apiUser(['admin']);
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, 'Invalid user id');

    const b = await readBody(req);
    const isActive = b.is_active ?? null;
    if (isActive !== null && typeof isActive !== 'boolean') throw new HttpError(400, 'is_active must be true or false');
    const role = text(b, 'role');
    if (isActive === null && role === null) throw new HttpError(400, 'Nothing to update');

    // An admin must not lock themselves out
    if (userId === user.user_id && isActive === false) throw new HttpError(400, 'You cannot deactivate your own account');
    if (userId === user.user_id && role !== null && role !== user.role) throw new HttpError(400, 'You cannot change your own role');

    const row = await withRole(user, async (db) => (await db.query(`
      UPDATE users
      SET is_active = COALESCE($2::boolean, is_active), role = COALESCE($3, role)
      WHERE user_id = $1
      RETURNING user_id, full_name, email, role, is_active
    `, [userId, isActive, role])).rows[0]);
    if (!row) throw new HttpError(404, `User ${userId} does not exist`);
    return row;
  });
}
