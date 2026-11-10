import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import ConditionPanel from '@/components/ConditionPanel';
import RiskBadge from '@/components/RiskBadge';
import StatusForm from '@/components/StatusForm';
import TransferForm from '@/components/TransferForm';
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b">
      <th className="w-48 p-2 text-left font-medium text-gray-600">{label}</th>
      <td className="p-2">{children ?? '—'}</td>
    </tr>
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
      <div>
        <p className="text-sm text-gray-500">{a.accession_number}</p>
        <h1 className="text-2xl font-semibold">{a.title}</h1>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Details</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <Field label="Category">{a.category}</Field>
            <Field label="Status">{a.status}</Field>
            <Field label="Location">{a.current_location}</Field>
            <Field label="Material">{a.material}</Field>
            <Field label="Origin / culture">{a.origin_culture}</Field>
            <Field label="Dating">
              {a.est_year_from === null && a.est_year_to === null ? null : `${year(a.est_year_from)} – ${year(a.est_year_to)}`}
            </Field>
            <Field label="Acquired by museum">{a.acquisition_date}</Field>
            <Field label="Years in collection">{a.years_in_collection}</Field>
            <Field label="Registered by">{a.registered_by}</Field>
            <Field label="Description">{a.description}</Field>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Provenance risk</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <Field label="Risk"><RiskBadge risk={s.provenance_risk} /></Field>
            <Field label="Owners on record">{s.n_owners}</Field>
            <Field label="Gaps over 1 year">{s.n_gaps}</Field>
            <Field label="Longest gap">{`${s.longest_gap_days} days`}</Field>
            <Field label="Unknown acquisitions">{s.n_unknown_acquisitions}</Field>
            <Field label="Dealer / auction house 1933–1945">{s.wartime_dealer ? 'yes' : 'no'}</Field>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Provenance chain</h2>
        {chain.length === 0 ? (
          <p className="text-sm text-gray-500">No ownership records.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Owner</th>
                <th className="p-2">Type</th>
                <th className="p-2">From</th>
                <th className="p-2">Until</th>
                <th className="p-2">Days held</th>
                <th className="p-2">Method</th>
                <th className="p-2">Price</th>
                <th className="p-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {chain.map((r) => (
                <tr key={r.acquired_from} className="border-b">
                  <td className="p-2">{r.owner_name}</td>
                  <td className="p-2">{r.owner_type}</td>
                  <td className="p-2">{r.acquired_from}</td>
                  <td className="p-2">{r.acquired_until ?? 'current'}</td>
                  <td className="p-2">{r.days_held}</td>
                  <td className="p-2">{r.acquisition_method}</td>
                  <td className="p-2">{r.price_paid === null ? '—' : `${r.price_paid.toLocaleString('en-IN')} ${r.currency ?? ''}`}</td>
                  <td className="p-2">{r.source_document ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Gaps in provenance</h2>
        {gaps.length === 0 ? (
          <p className="text-sm text-gray-500">No gaps longer than one year.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {gaps.map((g) => (
              <li key={g.gap_from} className="rounded border border-amber-500 bg-amber-50 p-2 text-amber-900">
                ⚠ {g.gap_from} → {g.gap_to} ({g.gap_days} days unaccounted) between {g.previous_owner} and {g.next_owner}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className="grid gap-6 md:grid-cols-2">
          <StatusForm accession={a.accession_number} status={a.status} location={a.current_location} />
          <TransferForm accession={a.accession_number} owners={owners} />
        </section>
      )}

      <ConditionPanel accession={a.accession_number} user={user} />
    </div>
  );
}
