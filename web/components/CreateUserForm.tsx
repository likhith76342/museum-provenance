'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { sendJson } from '@/lib/fetch-json';

export default function CreateUserForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border p-4 text-sm">
      <h2 className="text-lg font-semibold">Create user</h2>
      <div className="flex flex-wrap gap-2">
        <input name="full_name" required placeholder="Full name" className="rounded border p-1.5" />
        <input name="email" type="email" required placeholder="Email" className="rounded border p-1.5" />
        <select name="role" defaultValue="researcher" className="rounded border p-1.5">
          <option value="researcher">researcher</option>
          <option value="curator">curator</option>
          <option value="admin">admin</option>
        </select>
        <input name="password" type="password" required minLength={8} placeholder="Password (min 8)" className="rounded border p-1.5" />
        <button disabled={busy} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {done && <p className="text-green-700">{done}</p>}
    </form>
  );
}
