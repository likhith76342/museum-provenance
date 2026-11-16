'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { sendJson } from '@/lib/fetch-json';

export default function FlagReview({ flagId, status }: { flagId: number; status: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function review(newStatus: 'under_review' | 'confirmed' | 'dismissed') {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/flags/${flagId}/review`, 'POST', { status: newStatus, notes });
      router.refresh();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
      <Field label="Review notes" hint="Required to confirm or dismiss a flag.">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </Field>
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        {status !== 'under_review' && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => review('under_review')}>
            Under review
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => review('confirmed')}>
          Confirm
        </Button>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => review('dismissed')}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
