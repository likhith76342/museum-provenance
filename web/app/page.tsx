import Link from 'next/link';
import { Notice } from '@/components/ui/Notice';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';

type Counts = {
  artifacts: number;
  high_risk: number;
  no_provenance: number;
  open_flags: number;
  needs_inspection: number;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const c = await withRole(user, async (db) => (await db.query<Counts>(`
    SELECT (SELECT COUNT(*) FROM artifacts)                                                  AS artifacts,
           (SELECT COUNT(*) FROM v_provenance_summary WHERE provenance_risk = 'high')          AS high_risk,
           (SELECT COUNT(*) FROM v_provenance_summary WHERE provenance_risk = 'no_provenance') AS no_provenance,
           (SELECT COUNT(*) FROM v_open_flags)                                               AS open_flags,
           (SELECT COUNT(*) FROM v_latest_condition WHERE inspection_status <> 'ok')         AS needs_inspection
  `)).rows[0]);

  const cards: { label: string; value: number; href: string }[] = [
    { label: 'Artifacts', value: c.artifacts, href: '/artifacts' },
    { label: 'High provenance risk', value: c.high_risk, href: '/artifacts?risk=high' },
    { label: 'No provenance record', value: c.no_provenance, href: '/artifacts?risk=no_provenance' },
    { label: 'Open anomaly flags', value: c.open_flags, href: '/flags' },
    { label: 'Overdue or never inspected', value: c.needs_inspection, href: '/artifacts' },
  ];

  return (
    <div>
      {denied && (
        <div className="mb-6">
          <Notice tone="warn">You don&apos;t have access to that page.</Notice>
        </div>
      )}
      <h1 className="mb-1 text-2xl font-semibold">Welcome, {user.full_name}</h1>
      <p className="mb-6 text-sm text-gray-500">Signed in as {user.role}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded border p-4 hover:bg-gray-50">
            <div className="text-3xl font-semibold">{card.value}</div>
            <div className="text-sm text-gray-600">{card.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
