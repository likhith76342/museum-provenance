export const GRADE_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Fair',
  2: 'Poor',
  1: 'Critical',
};

/** timestamptz columns arrive as JS Date objects (only DATE/NUMERIC/COUNT are converted). */
export function fmtTs(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 16).replace('T', ' ');
}

/** Today as YYYY-MM-DD in local time. Called on the server and passed to the form as a prop,
 *  so the client form needs no effect to fill in the date. */
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
