import Link from 'next/link';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'warn' | 'bad';

const VALUE: Record<Tone, string> = {
  neutral: 'text-ink',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
};

const EDGE: Record<Tone, string> = {
  neutral: 'border-l-stone-300',
  good: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
  bad: 'border-l-red-500',
};

export function StatCard({
  label,
  value,
  href,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <div className={`font-serif text-3xl font-semibold tabular-nums ${VALUE[tone]}`}>{value}</div>
      <div className="mt-1 text-sm text-stone-600">{label}</div>
    </>
  );
  const cls = `block rounded-lg border border-l-4 border-stone-200 bg-white p-4 shadow-sm ${EDGE[tone]}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-stone-300 hover:bg-stone-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
