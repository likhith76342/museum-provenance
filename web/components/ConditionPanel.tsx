import Link from 'next/link';
import GradeChange from '@/components/GradeChange';
import { Badge } from '@/components/ui/Badge';
import { GradeBadge, InspectionBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
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
    <Card title="Condition">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {latest?.condition_grade != null && <GradeBadge grade={latest.condition_grade} />}
          {latest && <InspectionBadge status={latest.inspection_status} />}
          {latest?.last_inspected && (
            <span className="text-stone-600">
              Last inspected {latest.last_inspected} by {latest.curator_name}
            </span>
          )}
        </div>
        {user.role === 'curator' && (
          <LinkButton href={`/reports/new?accession=${encodeURIComponent(accession)}`} size="sm">
            File a report for this artifact
          </LinkButton>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState>No condition reports yet.</EmptyState>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Grade</TH>
              <TH>Change</TH>
              <TH>Curator</TH>
              <TH>Report</TH>
              <TH>Flags</TH>
            </tr>
          </THead>
          <TBody>
            {history.map((r) => (
              <TR key={r.report_id}>
                <TD className="whitespace-nowrap tabular-nums">
                  <Link href={`/reports/${r.report_id}`} className="text-accent hover:underline">
                    {r.report_date}
                  </Link>
                </TD>
                <TD className="whitespace-nowrap"><GradeBadge grade={r.condition_grade} /></TD>
                <TD className="whitespace-nowrap"><GradeChange change={r.grade_change} /></TD>
                <TD className="min-w-36">{r.curator}</TD>
                <TD className="min-w-64 text-stone-600">
                  {r.excerpt}
                  {r.excerpt.length >= 140 ? '…' : ''}
                </TD>
                <TD>
                  {r.n_flags > 0 && (
                    <Link href={`/reports/${r.report_id}`}>
                      <Badge tone="bad">{r.n_flags} {r.n_flags > 1 ? 'flags' : 'flag'}</Badge>
                    </Link>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
