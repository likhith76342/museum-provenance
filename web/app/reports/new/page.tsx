import NewReportForm from '@/components/NewReportForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireUser } from '@/lib/auth';
import { todayLocal } from '@/lib/condition';
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
      <PageHeader
        title="File a condition report"
        subtitle="The text is embedded when you save it, so the database can compare it with every earlier report."
      />
      <NewReportForm artifacts={artifacts} initialAccession={initial} today={todayLocal()} />
    </div>
  );
}
