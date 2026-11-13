import type { ApiError } from '@/lib/fetch-json';

/** Friendly message + the database rule that enforced it, in small grey text. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as Partial<ApiError> & { message?: string };
  const message = typeof error === 'string' ? error : e.message;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
      <p className="text-red-800">{message}</p>
      {e.detail && <p className="mt-1 font-mono text-xs text-stone-500">{e.detail}</p>}
    </div>
  );
}
