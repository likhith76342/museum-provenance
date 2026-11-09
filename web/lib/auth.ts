import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from './db';
import type { Role, SessionUser } from './types';

export const SESSION_COOKIE = 'museum_session';
export const SESSION_HOURS = 8;

/** Logged-in user from the session cookie, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { rows } = await pool.query('SELECT * FROM app_session_user($1)', [token]);
  return (rows[0] as SessionUser | undefined) ?? null;
}

/** For pages: redirect to /login if not logged in, to / if the role isn't allowed. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (roles && !roles.includes(user.role)) redirect('/?denied=1');
  return user;
}
