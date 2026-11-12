import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { gradeText } from '@/lib/condition';
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

  return (
    <div className="text-sm">
      <p className="mb-1">
        <Link href={`/artifacts/${encodeURIComponent(report.accession_number)}`} className="underline">
          ← {report.accession_number}
        </Link>
      </p>
      <h1 className="mb-3 text-2xl font-semibold">Condition report #{report.report_id}</h1>
      <table className="mb-4 border-collapse">
        <tbody>
          <tr><td className="py-1 pr-6 text-gray-500">Artifact</td><td>{report.accession_number} — {report.title}</td></tr>
          <tr><td className="py-1 pr-6 text-gray-500">Date</td><td>{report.report_date}</td></tr>
          <tr><td className="py-1 pr-6 text-gray-500">Grade</td><td>{gradeText(report.condition_grade)}</td></tr>
          <tr><td className="py-1 pr-6 text-gray-500">Curator</td><td>{report.curator}</td></tr>
        </tbody>
      </table>
      <p className="mb-6 max-w-3xl whitespace-pre-wrap rounded border p-3">{report.report_text}</p>

      <h2 className="mb-2 text-xl font-semibold">Most similar reports</h2>
      <table className="mb-6 w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Report</th>
            <th className="p-2">Artifact</th>
            <th className="p-2">Date</th>
            <th className="p-2">Grade</th>
            <th className="p-2">Same artifact?</th>
            <th className="p-2">Similarity</th>
          </tr>
        </thead>
        <tbody>
          {similar.map((s) => (
            <tr key={s.report_id} className="border-b">
              <td className="p-2"><Link href={`/reports/${s.report_id}`} className="underline">#{s.report_id}</Link></td>
              <td className="p-2">
                <Link href={`/artifacts/${encodeURIComponent(s.accession_number)}`} className="underline">{s.accession_number}</Link>
              </td>
              <td className="p-2">{s.report_date}</td>
              <td className="p-2">{gradeText(s.condition_grade)}</td>
              <td className="p-2">{s.same_artifact ? 'same artifact' : <strong>different artifact</strong>}</td>
              <td className="p-2">{s.similarity.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-xl font-semibold">Anomaly flags involving this report</h2>
      {flags.length === 0 ? (
        <p className="text-gray-500">None.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Flag</th>
              <th className="p-2">Type</th>
              <th className="p-2">Status</th>
              <th className="p-2">Flagged report</th>
              <th className="p-2">Compared with</th>
              <th className="p-2">Similarity</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.flag_id} className="border-b">
                <td className="p-2">#{f.flag_id}</td>
                <td className="p-2">{f.flag_type}</td>
                <td className="p-2">{f.status}</td>
                <td className="p-2"><Link href={`/reports/${f.report_id}`} className="underline">#{f.report_id}</Link></td>
                <td className="p-2">
                  {f.compared_report_id ? <Link href={`/reports/${f.compared_report_id}`} className="underline">#{f.compared_report_id}</Link> : '—'}
                </td>
                <td className="p-2">{f.similarity_score == null ? '—' : f.similarity_score.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4"><Link href="/flags" className="underline">All anomaly flags →</Link></p>
    </div>
  );
}
