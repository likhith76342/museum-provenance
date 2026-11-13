import { Accession } from '@/components/ui/Accession';
import { ArtifactStatusBadge, humanize, RiskBadge } from '@/components/ui/badges';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, inputClass } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';
import { EDITORS } from '@/lib/types';
import { CATEGORIES, RISKS, STATUSES } from './options';

type Row = {
  accession_number: string;
  title: string;
  category: string;
  status: string;
  current_owner: string | null;
  provenance_risk: string;
  n_owners: number;
};

type Filters = { q?: string | string[]; category?: string | string[]; status?: string | string[]; risk?: string | string[] };

/** First value of a query parameter, trimmed; empty -> null (= no filter). */
function param(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : null;
}

export default async function ArtifactsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = param(sp.q);
  const category = param(sp.category);
  const status = param(sp.status);
  const risk = param(sp.risk);

  const rows = await withRole(user, async (db) => (await db.query<Row>(`
    SELECT co.accession_number, co.title, co.category, co.status,
           co.owner_name AS current_owner, ps.provenance_risk, ps.n_owners
    FROM v_current_owner co
    JOIN v_provenance_summary ps ON ps.artifact_id = co.artifact_id
    WHERE ($1::text IS NULL OR co.title ILIKE '%' || $1 || '%' OR co.accession_number ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR co.category = $2)
      AND ($3::text IS NULL OR co.status = $3)
      AND ($4::text IS NULL OR ps.provenance_risk = $4)
    ORDER BY co.accession_number
  `, [q, category, status, risk])).rows);

  const filtered = q !== null || category !== null || status !== null || risk !== null;

  return (
    <div>
      <PageHeader
        title="Artifacts"
        subtitle={`${rows.length} artifact${rows.length === 1 ? '' : 's'}${filtered ? ' match the filters' : ' in the catalogue'}`}
        actions={EDITORS.includes(user.role) && <LinkButton href="/artifacts/new">Register artifact</LinkButton>}
      />

      <form
        method="get"
        className="mb-5 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
      >
        <Field label="Search">
          <input name="q" defaultValue={q ?? ''} placeholder="Title or accession number" className={inputClass} />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={category ?? ''} className={inputClass}>
            <option value="">All categories</option>
            {CATEGORIES.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={status ?? ''} className={inputClass}>
            <option value="">All statuses</option>
            {STATUSES.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <Field label="Provenance risk">
          <select name="risk" defaultValue={risk ?? ''} className={inputClass}>
            <option value="">All risk levels</option>
            {RISKS.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary">Filter</Button>
          <LinkButton href="/artifacts" variant="secondary">Clear</LinkButton>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState action={<LinkButton href="/artifacts" variant="secondary">Clear filters</LinkButton>}>
          No artifacts match these filters.
        </EmptyState>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Accession</TH>
              <TH>Title</TH>
              <TH>Category</TH>
              <TH>Status</TH>
              <TH>Current owner</TH>
              <TH className="text-right">Owners</TH>
              <TH>Provenance risk</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.accession_number}>
                <TD><Accession number={r.accession_number} /></TD>
                <TD className="min-w-48 font-medium">{r.title}</TD>
                <TD>{humanize(r.category)}</TD>
                <TD><ArtifactStatusBadge status={r.status} /></TD>
                <TD className="min-w-40">{r.current_owner ?? <span className="text-stone-400">—</span>}</TD>
                <TD className="text-right tabular-nums">{r.n_owners}</TD>
                <TD><RiskBadge risk={r.provenance_risk} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
