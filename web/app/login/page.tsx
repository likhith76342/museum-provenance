'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { sendJson } from '@/lib/fetch-json';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await sendJson('/api/auth/login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
      });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Coromandel Heritage Museum</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2" />
        <input name="password" type="password" placeholder="Password" required className="w-full rounded border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-black p-2 text-white disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
