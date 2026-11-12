import Link from 'next/link';
import FlagReview from '@/components/FlagReview';
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
    <div className="text-sm">
      <h1 className="mb-4 text-2xl font-semibold">Anomaly flags</h1>

      <h2 className="mb-2 text-xl font-semibold">Open / under review ({open.length})</h2>
      {open.length === 0 && <p className="mb-6 text-gray-500">No unresolved flags.</p>}
      <div className="mb-8 flex flex-col gap-4">
        {open.map((f) => (
          <div key={f.flag_id} className="rounded border p-3">
            <p className="mb-2">
              <strong>#{f.flag_id} {f.flag_type}</strong> · {f.accession_number} — {f.title} · status:{' '}
              <strong>{f.status}</strong> · similarity: {f.similarity_score == null ? '—' : f.similarity_score.toFixed(2)} · raised{' '}
              {fmtTs(f.raised_at)}
              {f.reviewer && <> · reviewer: {f.reviewer}</>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border bg-gray-50 p-2">
                <p className="mb-1 text-xs text-gray-500">
                  Flagged report <Link href={`/reports/${f.report_id}`} className="underline">#{f.report_id}</Link> ({f.report_date})
                </p>
                {f.report_excerpt}…
              </div>
              <div className="rounded border bg-gray-50 p-2">
                {f.compared_report_id ? (
                  <>
                    <p className="mb-1 text-xs text-gray-500">
                      Compared with <Link href={`/reports/${f.compared_report_id}`} className="underline">#{f.compared_report_id}</Link> ({f.compared_report_date})
                    </p>
                    {f.compared_excerpt}…
                  </>
                ) : (
                  <span className="text-gray-500">No comparison report.</span>
                )}
              </div>
            </div>
            {canReview && <FlagReview flagId={f.flag_id} status={f.status} />}
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-xl font-semibold">Resolved ({resolved.length})</h2>
      {resolved.length === 0 ? (
        <p className="text-gray-500">Nothing resolved yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Flag</th>
              <th className="p-2">Type</th>
              <th className="p-2">Artifact</th>
              <th className="p-2">Outcome</th>
              <th className="p-2">Similarity</th>
              <th className="p-2">Reviewer</th>
              <th className="p-2">Reviewed</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((f) => (
              <tr key={f.flag_id} className="border-b align-top">
                <td className="p-2">#{f.flag_id}</td>
                <td className="p-2">{f.flag_type}</td>
                <td className="p-2">{f.accession_number}</td>
                <td className="p-2">{f.status}</td>
                <td className="p-2">{f.similarity_score == null ? '—' : f.similarity_score.toFixed(2)}</td>
                <td className="p-2">{f.reviewer ?? '—'}</td>
                <td className="p-2 whitespace-nowrap">{fmtTs(f.reviewed_at)}</td>
                <td className="p-2">{f.review_notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
