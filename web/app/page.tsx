import { RoleBadge } from '@/components/ui/badges';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
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

  const cards: { label: string; value: number; href: string; tone: 'neutral' | 'warn' | 'bad' }[] = [
    { label: 'Artifacts', value: c.artifacts, href: '/artifacts', tone: 'neutral' },
    { label: 'High provenance risk', value: c.high_risk, href: '/artifacts?risk=high', tone: 'bad' },
    { label: 'No provenance record', value: c.no_provenance, href: '/artifacts?risk=no_provenance', tone: 'neutral' },
    { label: 'Open anomaly flags', value: c.open_flags, href: '/flags', tone: 'bad' },
    { label: 'Overdue or never inspected', value: c.needs_inspection, href: '/artifacts', tone: 'warn' },
  ];

  return (
    <div>
      {denied && (
        <div className="mb-6">
          <Notice tone="warn">You don&apos;t have access to that page.</Notice>
        </div>
      )}
      <PageHeader
        title={`Welcome, ${user.full_name}`}
        subtitle={<span className="inline-flex items-center gap-2">Signed in as <RoleBadge role={user.role} /></span>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            href={card.href}
            tone={Number(card.value) > 0 ? card.tone : 'neutral'}
          />
        ))}
      </div>
    </div>
  );
}
