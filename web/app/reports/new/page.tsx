import NewReportForm from '@/components/NewReportForm';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ accession?: string | string[] }> }) {
  const user = await requireUser(['curator']);
  const sp = await searchParams;
  const initial = (Array.isArray(sp.accession) ? sp.accession[0] : sp.accession) ?? '';

  const artifacts = await withRole(user, async (db) =>
    (await db.query<{ accession_number: string; title: string }>(
      'SELECT accession_number, title FROM artifacts ORDER BY accession_number',
    )).rows,
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">File a condition report</h1>
      <NewReportForm artifacts={artifacts} initialAccession={initial} />
    </div>
  );
}
