'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { Notice } from '@/components/ui/Notice';
import { sendJson } from '@/lib/fetch-json';

export default function CreateUserForm() {
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
    try {
      const res = await sendJson<{ user_id: number; email: string }>(
        '/api/admin/users',
        'POST',
        Object.fromEntries(new FormData(formEl)),
      );
      setDone(`Created user ${res.user_id} (${res.email}).`);
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_0.8fr_1fr_auto] lg:items-end">
        <Field label="Full name">
          <input name="full_name" required className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={inputClass} />
        </Field>
        <Field label="Role">
          <select name="role" defaultValue="researcher" className={inputClass}>
            <option value="researcher">Researcher</option>
            <option value="curator">Curator</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Password">
          <input name="password" type="password" required minLength={8} placeholder="Min 8 characters" className={inputClass} />
        </Field>
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create user'}</Button>
      </div>
      <FormError error={error} />
      {done && <Notice tone="good">{done}</Notice>}
    </form>
  );
}
