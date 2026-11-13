'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['researcher', 'curator', 'admin'];

/** Role dropdown + activate/deactivate button for one row of the users table. */
export default function UserControls({ userId, role, isActive }: { userId: number; role: Role; isActive: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function update(change: { is_active?: boolean; role?: Role }) {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/admin/users/${userId}`, 'PATCH', change);
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {/* key: reset the dropdown to the saved role after a refresh or a rejected change */}
        <select
          key={`${role}-${error ? 'error' : ''}`}
          defaultValue={role}
          disabled={busy}
          onChange={(e) => update({ role: e.target.value as Role })}
          className="rounded border p-1"
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button disabled={busy} onClick={() => update({ is_active: !isActive })} className="rounded border px-2 py-1 disabled:opacity-50">
          {isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
      <FormError error={error} />
    </div>
  );
}
