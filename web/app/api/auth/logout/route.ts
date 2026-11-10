import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { run } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  return run(async () => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await pool.query('SELECT app_logout($1)', [token]);
    store.delete(SESSION_COOKIE);
    return { ok: true };
  });
}
