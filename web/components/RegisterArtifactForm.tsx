'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CATEGORIES, STATUSES } from '@/app/artifacts/options';
import { sendJson } from '@/lib/fetch-json';

const input = 'mt-1 block w-full rounded border p-1.5';

export default function RegisterArtifactForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await sendJson<{ accession_number: string }>('/api/artifacts', 'POST', body);
      router.push(`/artifacts/${encodeURIComponent(res.accession_number)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Accession number
          <input name="accession_number" required placeholder="CHM-2026-0011" className={input} />
        </label>
        <label className="block">
          Title
          <input name="title" required className={input} />
        </label>
        <label className="block">
          Category
          <select name="category" required defaultValue="" className={input}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          Status
          <select name="status" defaultValue="in_storage" className={input}>
            {STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          Material
          <input name="material" className={input} />
        </label>
        <label className="block">
          Origin / culture
          <input name="origin_culture" className={input} />
        </label>
        <label className="block">
          Earliest year (negative = BCE)
          <input name="est_year_from" type="number" className={input} />
        </label>
        <label className="block">
          Latest year
          <input name="est_year_to" type="number" className={input} />
        </label>
        <label className="block">
          Acquired by museum on
          <input name="acquisition_date" type="date" className={input} />
        </label>
        <label className="block">
          Location
          <input name="current_location" className={input} />
        </label>
      </div>
      <label className="block">
        Description
        <textarea name="description" rows={4} className={input} />
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <button disabled={busy} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
        {busy ? 'Registering…' : 'Register artifact'}
      </button>
    </form>
  );
}
