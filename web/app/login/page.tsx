'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';

// Seed accounts from the README (demo app: saves typing during the presentation)
const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@museum.test', password: 'Admin@123' },
  { role: 'Curator', email: 'meera.iyer@museum.test', password: 'Curator@123' },
  { role: 'Curator', email: 'rahul.menon@museum.test', password: 'Curator@123' },
  { role: 'Researcher', email: 'kavya.nair@uni.test', password: 'Research@123' },
];

export default function LoginPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await sendJson('/api/auth/login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
      });
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function fill(email: string, password: string) {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem('email') as HTMLInputElement).value = email;
    (f.elements.namedItem('password') as HTMLInputElement).value = password;
  }

  return (
    <div className="mx-auto w-full max-w-sm py-6 sm:py-12">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Coromandel Heritage Museum</h1>
        <p className="mt-2 text-sm text-stone-500">Provenance &amp; condition records</p>
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <FormError error={error} />
        <Button disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-white/60 p-4 text-sm">
        <p className="mb-2 font-medium text-stone-700">Demo accounts</p>
        <p className="mb-3 text-xs text-stone-500">Click one to fill in the form.</p>
        <ul className="space-y-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => fill(a.email, a.password)}
                className="flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded px-2 py-1 text-left hover:bg-stone-100"
              >
                <span className="w-20 shrink-0 text-stone-500">{a.role}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink">{a.email}</span>
                <span className="font-mono text-xs text-stone-500">{a.password}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
