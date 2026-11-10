import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import type { Role, SessionUser } from './types';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** For route handlers: throws 401 / 403 instead of redirecting. */
export async function apiUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Not logged in');
  if (roles && !roles.includes(user.role)) throw new HttpError(403, `Role '${user.role}' cannot do this`);
  return user;
}

// PostgreSQL error codes -> HTTP status. The database's own message is returned,
// e.g. the trigger text "Curator ... was not active on ...".
const PG_STATUS: Record<string, number> = {
  '42501': 403, // insufficient_privilege (DB role, or review_flag's role check)
  '23505': 409, // unique_violation
  '23P01': 409, // exclusion_violation (overlapping ownership periods)
  '23514': 400, // check_violation (CHECKs and our triggers)
  '23503': 400, // foreign_key_violation
  '23502': 400, // not_null_violation
  '22P02': 400, // invalid input syntax
  '22007': 400, // invalid date format
  '22008': 400, // date out of range
  '22001': 400, // value too long
  'P0001': 400, // RAISE EXCEPTION in our procedures/triggers
};

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && PG_STATUS[code]) {
    return NextResponse.json({ error: (e as Error).message, code }, { status: PG_STATUS[code] });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** Wrap a route handler body: JSON result on success, mapped error otherwise. */
export async function run(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    return errorResponse(e);
  }
}
