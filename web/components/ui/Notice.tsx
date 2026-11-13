import type { ReactNode } from 'react';

type Tone = 'info' | 'good' | 'warn' | 'bad';

const TONES: Record<Tone, string> = {
  info: 'border-teal-200 bg-accent-soft text-teal-900',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  bad: 'border-red-200 bg-red-50 text-red-900',
};

const ICON: Record<Tone, ReactNode> = {
  info: <path d="M12 8h.01M11 12h1v5h1" />,
  good: <path d="m8 12.5 3 3 5-6" />,
  warn: <path d="M12 8v5m0 3h.01" />,
  bad: <path d="m9 9 6 6m0-6-6 6" />,
};

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-md border px-4 py-3 text-sm ${TONES[tone]}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        {ICON[tone]}
      </svg>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}
