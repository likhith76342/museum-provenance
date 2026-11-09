import { Pool, type PoolClient, types } from 'pg';
import type { Role } from './types';

// DATE -> 'YYYY-MM-DD' string. Default parsing creates a JS Date at local
// midnight, which shifts to the previous day when serialised as UTC (IST is +5:30).
types.setTypeParser(1082, (v) => v);
// NUMERIC and BIGINT (COUNT(*)) -> number for display
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

// One pool per server process (survives hot reload in dev)
const g = globalThis as unknown as { _museumPool?: Pool };
export const pool = g._museumPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== 'production') g._museumPool = pool;

// App role -> PostgreSQL role. Fixed whitelist, never built from user input.
const DB_ROLE: Record<Role, string> = {
  admin: 'app_admin',
  curator: 'app_curator',
  researcher: 'app_researcher',
};

/**
 * Run fn inside one transaction as the user's database role:
 *   BEGIN; SET LOCAL ROLE app_<role>; fn(); COMMIT (or ROLLBACK on any error)
 * The database GRANTs then decide what this request may do.
 */
export async function withRole<T>(user: { role: Role }, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (web/.env.local)');
  const dbRole = DB_ROLE[user.role];
  if (!dbRole) throw new Error(`Unknown role ${user.role}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${dbRole}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
