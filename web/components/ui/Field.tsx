import type { ReactNode } from 'react';

/** Shared look for <input>, <select> and <textarea>. */
export const inputClass =
  'block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-ink shadow-sm ' +
  'placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ' +
  'disabled:bg-stone-100 disabled:text-stone-500';

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}
