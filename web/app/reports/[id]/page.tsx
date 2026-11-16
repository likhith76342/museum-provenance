import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Accession } from '@/components/ui/Accession';
import { Badge } from '@/components/ui/Badge';
import { FlagStatusBadge, FlagTypeBadge, GradeBadge } from '@/components/ui/badges';
import { LinkButton } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';

type Report = {
  report_id: number;
  accession_number: string;
  title: string;
  report_date: string;
  condition_grade: number;
  report_text: string;
  curator: string;
};
type Similar = {
  report_id: number;
  accession_number: string;
  report_date: string;
  condition_grade: number;
  same_artifact: boolean;
  similarity: number;
};
type FlagRow = {
  flag_id: number;
  flag_type: string;
  status: string;
  similarity_score: number | null;
  report_id: number;
  compared_report_id: number | null;
};

/** A match on a DIFFERENT artifact at or above this similarity is worth a second look. */
const HOT = 0.8;

function SimilarityBar({ value, hot }: { value: number; hot: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${hot ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

function ReportLink({ id }: { id: number }) {
  return (
    <Link href={`/reports/${id}`} className="tabular-nums text-accent hover:underline">
      #{id}
    </Link>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) notFound();

  const data = await withRole(user, async (db) => {
    const report = (await db.query<Report>(
      `SELECT cr.report_id, a.accession_number, a.title, cr.report_date, cr.condition_grade,
              cr.report_text, c.full_name AS curator
       FROM condition_reports cr
       JOIN artifacts a ON a.artifact_id = cr.artifact_id
       JOIN curators c  ON c.curator_id  = cr.curator_id
       WHERE cr.report_id = $1`,
      [id],
    )).rows[0];
    if (!report) return null;
    const similar = (await db.query<Similar>('SELECT * FROM find_similar_reports($1::int, 5)', [id])).rows;
    const flags = (await db.query<FlagRow>(
      `SELECT flag_id, flag_type, status, similarity_score, report_id, compared_report_id
       FROM anomaly_flags WHERE report_id = $1 OR compared_report_id = $1 ORDER BY flag_id`,
      [id],
    )).rows;
    return { report, similar, flags };
  });
  if (!data) notFound();
  const { report, similar, flags } = data;
  const hasHot = similar.some((s) => !s.same_artifact && s.similarity >= HOT);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Condition report #${report.report_id}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Accession number={report.accession_number} />
            <span aria-hidden="true">·</span>
            <span>{report.title}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{report.report_date}</span>
            <span aria-hidden="true">·</span>
            <span>{report.curator}</span>
          </span>
        }
        actions={
          <>
            <GradeBadge grade={report.condition_grade} />
            <LinkButton href={`/artifacts/${encodeURIComponent(report.accession_number)}`} variant="secondary" size="sm">
              View artifact
            </LinkButton>
          </>
        }
      />

      <Card title="Report text">
        <p className="max-w-prose whitespace-pre-wrap leading-relaxed text-ink">{report.report_text}</p>
      </Card>

      <section className="space-y-3">
        <SectionTitle>Most similar reports</SectionTitle>
        {hasHot && (
          <Notice tone="warn" title="A report on a different artifact reads almost the same">
            {"That can mean this report was filed under the wrong object."}
          </Notice>
        )}
        {similar.length === 0 ? (
          <EmptyState>No other reports to compare with.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Report</TH>
                <TH>Artifact</TH>
                <TH>Date</TH>
                <TH>Grade</TH>
                <TH>Match</TH>
                <TH>Similarity</TH>
              </tr>
            </THead>
            <TBody>
              {similar.map((s) => {
                const hot = !s.same_artifact && s.similarity >= HOT;
                return (
                  <TR key={s.report_id} className={hot ? 'bg-red-50/50' : ''}>
                    <TD><ReportLink id={s.report_id} /></TD>
                    <TD><Accession number={s.accession_number} /></TD>
                    <TD className="whitespace-nowrap tabular-nums">{s.report_date}</TD>
                    <TD className="whitespace-nowrap"><GradeBadge grade={s.condition_grade} /></TD>
                    <TD>
                      {s.same_artifact ? (
                        <Badge tone="neutral">Same artifact</Badge>
                      ) : (
                        <Badge tone="warn">Different artifact</Badge>
                      )}
                    </TD>
                    <TD><SimilarityBar value={s.similarity} hot={hot} /></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <SectionTitle>Anomaly flags involving this report</SectionTitle>
        {flags.length === 0 ? (
          <EmptyState>No flags involve this report.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Flag</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Flagged report</TH>
                <TH>Compared with</TH>
                <TH className="text-right">Similarity</TH>
              </tr>
            </THead>
            <TBody>
              {flags.map((f) => (
                <TR key={f.flag_id}>
                  <TD className="tabular-nums">#{f.flag_id}</TD>
                  <TD><FlagTypeBadge type={f.flag_type} /></TD>
                  <TD><FlagStatusBadge status={f.status} /></TD>
                  <TD><ReportLink id={f.report_id} /></TD>
                  <TD>{f.compared_report_id ? <ReportLink id={f.compared_report_id} /> : <span className="text-stone-400">—</span>}</TD>
                  <TD className="text-right tabular-nums">
                    {f.similarity_score == null ? <span className="text-stone-400">—</span> : f.similarity_score.toFixed(2)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="mt-4">
          <LinkButton href="/flags" variant="secondary" size="sm">All anomaly flags</LinkButton>
        </div>
      </section>
    </div>
  );
}
