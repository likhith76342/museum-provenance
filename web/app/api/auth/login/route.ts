import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { HttpError, run } from '@/lib/api';
import { SESSION_COOKIE, SESSION_HOURS } from '@/lib/auth';

export async function POST(req: Request) {
  return run(async () => {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    // Password is checked inside the database (bcrypt via pgcrypto)
    const { rows } = await pool.query('SELECT * FROM app_login($1, $2)', [email, password]);
    if (!rows[0]) throw new HttpError(401, 'Invalid email or password');

    (await cookies()).set(SESSION_COOKIE, rows[0].token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    });
    return { user_id: rows[0].user_id, full_name: rows[0].full_name, role: rows[0].role };
  });
}
