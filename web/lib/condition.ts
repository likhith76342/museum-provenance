export const GRADE_LABELS: Record<number, string> = {
  5: 'excellent',
  4: 'good',
  3: 'fair',
  2: 'poor',
  1: 'critical',
};

export function gradeText(g: number | null | undefined): string {
  return g == null ? '—' : `${g} (${GRADE_LABELS[g] ?? '?'})`;
}

/** timestamptz columns arrive as JS Date objects (only DATE/NUMERIC/COUNT are converted). */
export function fmtTs(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 16).replace('T', ' ');
}
