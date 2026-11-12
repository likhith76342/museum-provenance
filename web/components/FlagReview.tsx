'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sendJson } from '@/lib/fetch-json';

export default function FlagReview({ flagId, status }: { flagId: number; status: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(newStatus: 'under_review' | 'confirmed' | 'dismissed') {
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/flags/${flagId}/review`, 'POST', { status: newStatus, notes });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Review notes (required to confirm or dismiss)"
        className="rounded border p-1.5"
      />
      <div className="flex gap-2">
        {status !== 'under_review' && (
          <button disabled={busy} onClick={() => review('under_review')} className="rounded border px-3 py-1 disabled:opacity-50">
            Under review
          </button>
        )}
        <button disabled={busy} onClick={() => review('confirmed')} className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50">
          Confirm
        </button>
        <button disabled={busy} onClick={() => review('dismissed')} className="rounded bg-gray-700 px-3 py-1 text-white disabled:opacity-50">
          Dismiss
        </button>
      </div>
      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{error}</p>}
    </div>
  );
}
