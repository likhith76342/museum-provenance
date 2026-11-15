import type { ReactNode } from 'react';

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center text-sm text-stone-500">
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
