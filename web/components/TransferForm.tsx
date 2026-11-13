'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ACQUISITION_METHODS } from '@/app/artifacts/options';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';

type Owner = { owner_id: number; owner_name: string; owner_type: string };

export default function TransferForm({ accession, owners }: { accession: string; owners: Owner[] }) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone('');
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const res = await sendJson<{ owner_name: string; held_since: string }>(
        `/api/artifacts/${encodeURIComponent(accession)}/transfer`,
        'POST',
        {
          new_owner_id: form.get('new_owner_id'),
          transfer_date: form.get('transfer_date'),
          method: form.get('method'),
          price: form.get('price'),
          currency: form.get('currency'),
          document: form.get('document'),
        },
      );
      setDone(`Transferred to ${res.owner_name} from ${res.held_since}.`);
      formEl.reset();
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border p-4 text-sm">
      <h2 className="text-lg font-semibold">Transfer ownership</h2>
      <label className="block">
        New owner
        <select name="new_owner_id" required defaultValue="" className="mt-1 block w-full rounded border p-1.5">
          <option value="" disabled>Choose an owner</option>
          {owners.map((o) => (
            <option key={o.owner_id} value={o.owner_id}>{o.owner_name} ({o.owner_type})</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          Date
          <input name="transfer_date" type="date" required className="mt-1 block w-full rounded border p-1.5" />
        </label>
        <label className="block">
          Method
          <select name="method" required defaultValue="purchase" className="mt-1 block w-full rounded border p-1.5">
            {ACQUISITION_METHODS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          Price (optional)
          <input name="price" type="number" min="0" step="0.01" className="mt-1 block w-full rounded border p-1.5" />
        </label>
        <label className="block">
          Currency
          <input name="currency" maxLength={3} placeholder="INR" className="mt-1 block w-full rounded border p-1.5 uppercase" />
        </label>
      </div>
      <label className="block">
        Source document (optional)
        <input name="document" className="mt-1 block w-full rounded border p-1.5" />
      </label>
      <FormError error={error} />
      {done && <p className="text-green-700">{done}</p>}
      <button disabled={busy} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
        {busy ? 'Transferring…' : 'Transfer'}
      </button>
    </form>
  );
}
