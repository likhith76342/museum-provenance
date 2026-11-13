'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { STATUSES } from '@/app/artifacts/options';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';

export default function StatusForm({
  accession,
  status,
  location,
}: {
  accession: string;
  status: string;
  location: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      await sendJson(`/api/artifacts/${encodeURIComponent(accession)}`, 'PATCH', {
        status: form.get('status'),
        current_location: form.get('current_location'),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border p-4 text-sm">
      <h2 className="text-lg font-semibold">Status and location</h2>
      <label className="block">
        Status
        <select name="status" defaultValue={status} className="mt-1 block w-full rounded border p-1.5">
          {STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className="block">
        Location
        <input name="current_location" defaultValue={location ?? ''} className="mt-1 block w-full rounded border p-1.5" />
      </label>
      <FormError error={error} />
      {saved && <p className="text-green-700">Saved.</p>}
      <button disabled={busy} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
