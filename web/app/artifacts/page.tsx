import Link from 'next/link';
import RiskBadge from '@/components/RiskBadge';
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        {EDITORS.includes(user.role) && (
          <Link href="/artifacts/new" className="rounded bg-black px-3 py-1.5 text-sm text-white">
            Register artifact
          </Link>
        )}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <input name="q" defaultValue={q ?? ''} placeholder="Title or accession number" className="rounded border p-1.5" />
        <select name="category" defaultValue={category ?? ''} className="rounded border p-1.5">
          <option value="">All categories</option>
          {CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ''} className="rounded border p-1.5">
          <option value="">All statuses</option>
          {STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select name="risk" defaultValue={risk ?? ''} className="rounded border p-1.5">
          <option value="">All risk levels</option>
          {RISKS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <button className="rounded border px-3 py-1.5">Filter</button>
        <Link href="/artifacts" className="px-2 py-1.5 underline">Clear</Link>
      </form>

      <p className="mb-2 text-sm text-gray-500">{rows.length} artifact(s)</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Accession</th>
            <th className="p-2">Title</th>
            <th className="p-2">Category</th>
            <th className="p-2">Status</th>
            <th className="p-2">Current owner</th>
            <th className="p-2">Owners</th>
            <th className="p-2">Provenance risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accession_number} className="border-b">
              <td className="p-2">
                <Link href={`/artifacts/${encodeURIComponent(r.accession_number)}`} className="underline">
                  {r.accession_number}
                </Link>
              </td>
              <td className="p-2">{r.title}</td>
              <td className="p-2">{r.category}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.current_owner ?? '—'}</td>
              <td className="p-2">{r.n_owners}</td>
              <td className="p-2"><RiskBadge risk={r.provenance_risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
