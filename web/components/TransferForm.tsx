'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ACQUISITION_METHODS } from '@/app/artifacts/options';
import { humanize } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { Notice } from '@/components/ui/Notice';
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
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="New owner">
        <select name="new_owner_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose an owner</option>
          {owners.map((o) => (
            <option key={o.owner_id} value={o.owner_id}>{o.owner_name} ({humanize(o.owner_type)})</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input name="transfer_date" type="date" required className={inputClass} />
        </Field>
        <Field label="Method">
          <select name="method" required defaultValue="purchase" className={inputClass}>
            {ACQUISITION_METHODS.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <Field label="Price" hint="Optional">
          <input name="price" type="number" min="0" step="0.01" className={inputClass} />
        </Field>
        <Field label="Currency" hint="3-letter code, needed with a price">
          <input name="currency" maxLength={3} placeholder="INR" className={`${inputClass} uppercase`} />
        </Field>
      </div>
      <Field label="Source document" hint="Optional">
        <input name="document" className={inputClass} />
      </Field>
      <FormError error={error} />
      {done && <Notice tone="good">{done}</Notice>}
      <Button disabled={busy}>{busy ? 'Transferring…' : 'Transfer'}</Button>
    </form>
  );
}
