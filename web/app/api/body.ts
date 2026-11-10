// Request-body helpers for the route handlers (not a route itself: no route.ts).
import { HttpError } from '@/lib/api';

export type Body = Record<string, unknown>;

export async function readBody(req: Request): Promise<Body> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  return body as Body;
}

/**
 * Optional text field: missing, null or blank -> null, otherwise trimmed.
 * Numbers and dates stay text here; the SQL casts them ($n::int, $n::date),
 * so a bad value comes back as the database's own error message.
 */
export function text(body: Body, key: string): string | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') throw new HttpError(400, `${key} must be a string`);
  const s = v.trim();
  return s === '' ? null : s;
}

export function requiredText(body: Body, key: string, label: string): string {
  const v = text(body, key);
  if (v === null) throw new HttpError(400, `${label} is required`);
  return v;
}
