import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import ConditionPanel from '@/components/ConditionPanel';
import StatusForm from '@/components/StatusForm';
import TransferForm from '@/components/TransferForm';
import { Accession } from '@/components/ui/Accession';
import { Badge } from '@/components/ui/Badge';
import { ArtifactStatusBadge, humanize, RiskBadge } from '@/components/ui/badges';
import { Card, SectionTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';

type Artifact = {
  accession_number: string;
  title: string;
  category: string;
  material: string | null;
  origin_culture: string | null;
  est_year_from: number | null;
  est_year_to: number | null;
  acquisition_date: string | null;
  current_location: string | null;
  status: string;
  description: string | null;
  registered_by: string | null;
  years_in_collection: number | null;
};

type Summary = {
  provenance_risk: string;
  n_owners: number;
  n_gaps: number;
  longest_gap_days: number;
  n_unknown_acquisitions: number;
  wartime_dealer: boolean;
  earliest_record: string | null;
};

type ChainRow = {
  owner_name: string;
  owner_type: string;
  acquired_from: string;
  acquired_until: string | null;
  acquisition_method: string;
  price_paid: number | null;
  currency: string | null;
  source_document: string | null;
  days_held: number;
};

type Gap = {
  previous_owner: string;
  next_owner: string;
  gap_from: string;
  gap_to: string;
  gap_days: number;
};

type Owner = { owner_id: number; owner_name: string; owner_type: string };

/** Negative years are BCE (see artifacts.est_year_from). */
function year(y: number | null) {
  if (y === null) return '?';
  return y < 0 ? `${-y} BCE` : String(y);
}

/** One entry of a definition list; empty values show as a dash. */
function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children ?? <span className="text-stone-400">—</span>}</dd>
    </div>
  );
}

export default async function ArtifactPage({ params }: { params: Promise<{ accession: string }> }) {
  const user = await requireUser();
  const { accession } = await params;
  const canEdit = EDITORS.includes(user.role);

  const data = await withRole(user, async (db) => {
    const artifact = (await db.query<Artifact>(`
      SELECT a.*, u.full_name AS registered_by,
             EXTRACT(YEAR FROM age(CURRENT_DATE, a.acquisition_date))::int AS years_in_collection
      FROM artifacts a
      LEFT JOIN users u ON u.user_id = a.created_by
      WHERE a.accession_number = $1
    `, [accession])).rows[0];
    if (!artifact) return null;

    const summary = (await db.query<Summary>(
      'SELECT * FROM v_provenance_summary WHERE accession_number = $1', [accession],
    )).rows[0];

    const chain = (await db.query<ChainRow>(`
      SELECT o.owner_name, o.owner_type, oh.acquired_from, oh.acquired_until, oh.acquisition_method,
             oh.price_paid, oh.currency, oh.source_document,
             COALESCE(oh.acquired_until, CURRENT_DATE) - oh.acquired_from AS days_held
      FROM ownership_history oh
      JOIN owners o    ON o.owner_id    = oh.owner_id
      JOIN artifacts a ON a.artifact_id = oh.artifact_id
      WHERE a.accession_number = $1
      ORDER BY oh.acquired_from
    `, [accession])).rows;

    const gaps = (await db.query<Gap>('SELECT * FROM artifact_gaps($1)', [accession])).rows;

    const owners = canEdit
      ? (await db.query<Owner>('SELECT owner_id, owner_name, owner_type FROM owners ORDER BY owner_name')).rows
      : [];

    return { artifact, summary, chain, gaps, owners };
  });
  if (!data) notFound();
  const { artifact: a, summary: s, chain, gaps, owners } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={a.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Accession number={a.accession_number} link={false} />
            <span aria-hidden="true">·</span>
            <span>{humanize(a.category)}</span>
          </span>
        }
        actions={<ArtifactStatusBadge status={a.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Item label="Category">{humanize(a.category)}</Item>
            <Item label="Status"><ArtifactStatusBadge status={a.status} /></Item>
            <Item label="Location">{a.current_location}</Item>
            <Item label="Material">{a.material}</Item>
            <Item label="Origin / culture">{a.origin_culture}</Item>
            <Item label="Dating">
              {a.est_year_from === null && a.est_year_to === null ? null : `${year(a.est_year_from)} – ${year(a.est_year_to)}`}
            </Item>
            <Item label="Acquired by museum">{a.acquisition_date}</Item>
            <Item label="Years in collection">{a.years_in_collection}</Item>
            <Item label="Registered by">{a.registered_by}</Item>
            <Item label="Description" wide>{a.description}</Item>
          </dl>
        </Card>

        <Card title="Provenance risk">
          <div className="mb-4"><RiskBadge risk={s.provenance_risk} /></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-1">
            <Item label="Owners on record">{s.n_owners}</Item>
            <Item label="Gaps over 1 year">{s.n_gaps}</Item>
            <Item label="Longest gap">{`${s.longest_gap_days} days`}</Item>
            <Item label="Unknown acquisitions">{s.n_unknown_acquisitions}</Item>
            <Item label="Dealer / auction house 1933–1945" wide>{s.wartime_dealer ? 'Yes' : 'No'}</Item>
          </dl>
        </Card>
      </div>

      <section>
        <SectionTitle>Provenance chain</SectionTitle>
        {chain.length === 0 ? (
          <EmptyState>No ownership records.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Owner</TH>
                <TH>Type</TH>
                <TH>From</TH>
                <TH>Until</TH>
                <TH className="text-right">Days held</TH>
                <TH>Method</TH>
                <TH className="text-right">Price</TH>
                <TH>Source</TH>
              </tr>
            </THead>
            <TBody>
              {chain.map((r) => (
                <TR key={r.acquired_from}>
                  <TD className="min-w-44 font-medium">{r.owner_name}</TD>
                  <TD>{humanize(r.owner_type)}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{r.acquired_from}</TD>
                  <TD className="whitespace-nowrap tabular-nums">
                    {r.acquired_until ?? <Badge tone="info">Current</Badge>}
                  </TD>
                  <TD className="text-right tabular-nums">{r.days_held.toLocaleString('en-IN')}</TD>
                  <TD>{humanize(r.acquisition_method)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">
                    {r.price_paid === null ? <span className="text-stone-400">—</span> : `${r.price_paid.toLocaleString('en-IN')} ${r.currency ?? ''}`}
                  </TD>
                  <TD className="min-w-48 text-stone-600">{r.source_document ?? <span className="text-stone-400">—</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <SectionTitle>Gaps in provenance</SectionTitle>
        {gaps.length === 0 ? (
          <Notice tone="good">No gaps longer than one year.</Notice>
        ) : (
          <div className="space-y-2">
            {gaps.map((g) => (
              <Notice key={g.gap_from} tone="warn">
                <strong>{g.gap_days} days unaccounted:</strong> {g.gap_from} → {g.gap_to}, between {g.previous_owner} and{' '}
                {g.next_owner}
              </Notice>
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <section className="grid items-start gap-6 md:grid-cols-2">
          <Card title="Status and location">
            <StatusForm accession={a.accession_number} status={a.status} location={a.current_location} />
          </Card>
          <Card title="Transfer ownership">
            <TransferForm accession={a.accession_number} owners={owners} />
          </Card>
        </section>
      )}

      <ConditionPanel accession={a.accession_number} user={user} />
    </div>
  );
}
