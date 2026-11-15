'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { humanize } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Field';
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* key: reset the dropdown to the saved role after a refresh or a rejected change */}
        <select
          key={`${role}-${error ? 'error' : ''}`}
          defaultValue={role}
          disabled={busy}
          onChange={(e) => update({ role: e.target.value as Role })}
          aria-label="Role"
          className={`${inputClass} w-auto py-1`}
        >
          {ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
        </select>
        <Button
          variant={isActive ? 'danger' : 'secondary'}
          size="sm"
          disabled={busy}
          onClick={() => update({ is_active: !isActive })}
        >
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
      <div className="max-w-xs"><FormError error={error} /></div>
    </div>
  );
}
