import { apiUser, HttpError, run } from '@/lib/api';
import { withRole } from '@/lib/db';
import { readBody, requiredText } from '../../body';

// Create a user account (admin only). The password is hashed inside the
// database with bcrypt (pgcrypto); the app never stores or compares it.
export async function POST(req: Request) {
  return run(async () => {
    const user = await apiUser(['admin']);
    const b = await readBody(req);
    const fullName = requiredText(b, 'full_name', 'Name');
    const email = requiredText(b, 'email', 'Email');
    const role = requiredText(b, 'role', 'Role');
    const password = typeof b.password === 'string' ? b.password : ''; // not trimmed
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

    return withRole(user, async (db) => (await db.query(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, crypt($3, gen_salt('bf')), $4)
      RETURNING user_id, full_name, email, role, is_active
    `, [fullName, email, password, role])).rows[0]);
  }, 201);
}
