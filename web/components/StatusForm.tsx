'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { STATUSES } from '@/app/artifacts/options';
import { humanize } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { Notice } from '@/components/ui/Notice';
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
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Status">
        <select name="status" defaultValue={status} className={inputClass}>
          {STATUSES.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
        </select>
      </Field>
      <Field label="Location">
        <input name="current_location" defaultValue={location ?? ''} className={inputClass} />
      </Field>
      <FormError error={error} />
      {saved && <Notice tone="good">Saved.</Notice>}
      <Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}
