import Link from 'next/link';
import GradeChange from '@/components/GradeChange';
import { gradeText } from '@/lib/condition';
import { withRole } from '@/lib/db';
import type { SessionUser } from '@/lib/types';

type Latest = {
  report_id: number | null;
  last_inspected: string | null;
  condition_grade: number | null;
  curator_name: string | null;
  inspection_status: 'ok' | 'overdue' | 'never_inspected';
};

type HistoryRow = {
  report_id: number;
  report_date: string;
  condition_grade: number;
  grade_change: number | null;
  curator: string;
  excerpt: string;
  n_flags: number;
};

const BADGE: Record<Latest['inspection_status'], string> = {
  ok: 'bg-green-100 text-green-800',
  overdue: 'bg-amber-100 text-amber-800',
  never_inspected: 'bg-gray-200 text-gray-700',
};

export default async function ConditionPanel({ accession, user }: { accession: string; user: SessionUser }) {
  const { latest, history } = await withRole(user, async (db) => {
    const latest = (await db.query<Latest>(
      `SELECT report_id, last_inspected, condition_grade, curator_name, inspection_status
       FROM v_latest_condition WHERE accession_number = $1`,
      [accession],
    )).rows[0];
    const history = (await db.query<HistoryRow>(
      `SELECT cr.report_id, cr.report_date, cr.condition_grade,
              cr.condition_grade - LAG(cr.condition_grade) OVER (ORDER BY cr.report_date) AS grade_change,
              c.full_name AS curator, LEFT(cr.report_text, 140) AS excerpt,
              (SELECT COUNT(*) FROM anomaly_flags f WHERE f.report_id = cr.report_id) AS n_flags
       FROM condition_reports cr
       JOIN artifacts a ON a.artifact_id = cr.artifact_id
       JOIN curators c  ON c.curator_id  = cr.curator_id
       WHERE a.accession_number = $1
       ORDER BY cr.report_date DESC`,
      [accession],
    )).rows;
    return { latest, history };
  });

  return (
    <section className="mt-8 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Condition</h2>
        {user.role === 'curator' && (
          <Link href={`/reports/new?accession=${encodeURIComponent(accession)}`} className="rounded bg-black px-3 py-1.5 text-white">
            File a report for this artifact
          </Link>
        )}
      </div>

      {latest && (
        <p className="mb-3">
          Latest condition: <strong>{gradeText(latest.condition_grade)}</strong>
          {latest.last_inspected && <> · last inspected {latest.last_inspected} by {latest.curator_name}</>}{' '}
          <span className={`rounded px-2 py-0.5 text-xs ${BADGE[latest.inspection_status]}`}>
            {latest.inspection_status.replace('_', ' ')}
          </span>
        </p>
      )}

      {history.length === 0 ? (
        <p className="text-gray-500">No condition reports yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Grade</th>
              <th className="p-2">Change</th>
              <th className="p-2">Curator</th>
              <th className="p-2">Report</th>
              <th className="p-2">Flags</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.report_id} className="border-b align-top">
                <td className="p-2 whitespace-nowrap">
                  <Link href={`/reports/${r.report_id}`} className="underline">{r.report_date}</Link>
                </td>
                <td className="p-2 whitespace-nowrap">{gradeText(r.condition_grade)}</td>
                <td className="p-2 whitespace-nowrap"><GradeChange change={r.grade_change} /></td>
                <td className="p-2">{r.curator}</td>
                <td className="p-2 text-gray-700">{r.excerpt}{r.excerpt.length >= 140 ? '…' : ''}</td>
                <td className="p-2">
                  {r.n_flags > 0 ? (
                    <Link href={`/reports/${r.report_id}`} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      {r.n_flags} flag{r.n_flags > 1 ? 's' : ''}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
