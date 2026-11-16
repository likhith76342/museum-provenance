import Link from 'next/link';
import FlagReview from '@/components/FlagReview';
import { Accession } from '@/components/ui/Accession';
import { FlagStatusBadge, FlagTypeBadge } from '@/components/ui/badges';
import { Card, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireUser } from '@/lib/auth';
import { fmtTs } from '@/lib/condition';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';

type OpenFlag = {
  flag_id: number;
  flag_type: string;
  status: string;
  similarity_score: number | null;
  raised_at: Date;
  accession_number: string;
  title: string;
  report_id: number;
  report_date: string;
  report_excerpt: string;
  compared_report_id: number | null;
  compared_report_date: string | null;
  compared_excerpt: string | null;
  reviewer: string | null;
};
type ResolvedFlag = {
  flag_id: number;
  flag_type: string;
  status: string;
  similarity_score: number | null;
  accession_number: string;
  reviewer: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
};

function Excerpt({ label, id, date, text }: { label: string; id: number; date: string; text: string }) {
  return (
    <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-stone-500">
        {label}{' '}
        <Link href={`/reports/${id}`} className="tabular-nums normal-case tracking-normal text-accent hover:underline">
          #{id}
        </Link>{' '}
        <span className="normal-case tracking-normal tabular-nums">({date})</span>
      </p>
      <p className="text-stone-700">{text}…</p>
    </div>
  );
}

export default async function FlagsPage() {
  const user = await requireUser();
  const canReview = EDITORS.includes(user.role);

  const { open, resolved } = await withRole(user, async (db) => {
    const open = (await db.query<OpenFlag>('SELECT * FROM v_open_flags ORDER BY raised_at, flag_id')).rows;
    const resolved = (await db.query<ResolvedFlag>(
      `SELECT f.flag_id, f.flag_type, f.status, f.similarity_score, a.accession_number,
              u.full_name AS reviewer, f.reviewed_at, f.review_notes
       FROM anomaly_flags f
       JOIN condition_reports r ON r.report_id = f.report_id
       JOIN artifacts a         ON a.artifact_id = r.artifact_id
       LEFT JOIN users u        ON u.user_id = f.reviewed_by
       WHERE f.status IN ('confirmed', 'dismissed')
       ORDER BY f.reviewed_at DESC`,
    )).rows;
    return { open, resolved };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Anomaly flags"
        subtitle={`${open.length} open or under review · ${resolved.length} resolved`}
      />

      {!canReview && (
        <Notice tone="info">{"Read-only: researchers can't review flags."}</Notice>
      )}

      <section className="space-y-4">
        <SectionTitle>Open and under review</SectionTitle>
        {open.length === 0 && <EmptyState>No unresolved flags.</EmptyState>}
        {open.map((f) => (
          <Card key={f.flag_id}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm tabular-nums text-stone-500">#{f.flag_id}</span>
              <FlagTypeBadge type={f.flag_type} />
              <FlagStatusBadge status={f.status} />
              <Accession number={f.accession_number} />
              <span className="text-sm text-stone-700">{f.title}</span>
              {f.similarity_score != null && (
                <span className="text-sm tabular-nums text-stone-600">similarity {f.similarity_score.toFixed(2)}</span>
              )}
            </div>
            <p className="mb-3 text-xs text-stone-500">
              Raised {fmtTs(f.raised_at)}
              {f.reviewer && <> · reviewer: {f.reviewer}</>}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Excerpt label="Flagged report" id={f.report_id} date={f.report_date} text={f.report_excerpt} />
              {f.compared_report_id != null && f.compared_report_date != null ? (
                <Excerpt
                  label="Compared with"
                  id={f.compared_report_id}
                  date={f.compared_report_date}
                  text={f.compared_excerpt ?? ''}
                />
              ) : (
                <div className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                  No comparison report for this flag.
                </div>
              )}
            </div>
            {canReview && <FlagReview flagId={f.flag_id} status={f.status} />}
          </Card>
        ))}
      </section>

      <section>
        <SectionTitle>Resolved</SectionTitle>
        {resolved.length === 0 ? (
          <EmptyState>Nothing resolved yet.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Flag</TH>
                <TH>Type</TH>
                <TH>Artifact</TH>
                <TH>Outcome</TH>
                <TH className="text-right">Similarity</TH>
                <TH>Reviewer</TH>
                <TH>Reviewed</TH>
                <TH>Notes</TH>
              </tr>
            </THead>
            <TBody>
              {resolved.map((f) => (
                <TR key={f.flag_id}>
                  <TD className="tabular-nums">#{f.flag_id}</TD>
                  <TD><FlagTypeBadge type={f.flag_type} /></TD>
                  <TD><Accession number={f.accession_number} /></TD>
                  <TD><FlagStatusBadge status={f.status} /></TD>
                  <TD className="text-right tabular-nums">
                    {f.similarity_score == null ? <span className="text-stone-400">—</span> : f.similarity_score.toFixed(2)}
                  </TD>
                  <TD className="min-w-32">{f.reviewer ?? <span className="text-stone-400">—</span>}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{fmtTs(f.reviewed_at)}</TD>
                  <TD className="min-w-56 text-stone-600">{f.review_notes ?? <span className="text-stone-400">—</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
