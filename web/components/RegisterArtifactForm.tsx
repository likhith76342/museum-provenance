'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CATEGORIES, STATUSES } from '@/app/artifacts/options';
import { humanize } from '@/components/ui/badges';
import { Button, LinkButton } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';

export default function RegisterArtifactForm() {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await sendJson<{ accession_number: string }>('/api/artifacts', 'POST', body);
      router.push(`/artifacts/${encodeURIComponent(res.accession_number)}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Accession number" hint="e.g. CHM-2026-0011">
          <input name="accession_number" required placeholder="CHM-2026-0011" className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Title">
          <input name="title" required className={inputClass} />
        </Field>
        <Field label="Category">
          <select name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="in_storage" className={inputClass}>
            {STATUSES.map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </Field>
        <Field label="Material">
          <input name="material" className={inputClass} />
        </Field>
        <Field label="Origin / culture">
          <input name="origin_culture" className={inputClass} />
        </Field>
        <Field label="Estimated year from" hint="Negative years are BCE">
          <input name="est_year_from" type="number" className={inputClass} />
        </Field>
        <Field label="Estimated year to">
          <input name="est_year_to" type="number" className={inputClass} />
        </Field>
        <Field label="Acquired by museum on">
          <input name="acquisition_date" type="date" className={inputClass} />
        </Field>
        <Field label="Location">
          <input name="current_location" className={inputClass} />
        </Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={4} className={inputClass} />
      </Field>
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy}>{busy ? 'Registering…' : 'Register artifact'}</Button>
        <LinkButton href="/artifacts" variant="secondary">Cancel</LinkButton>
      </div>
    </form>
  );
}
