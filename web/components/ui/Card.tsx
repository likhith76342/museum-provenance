import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 font-serif text-lg font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

/** Heading for a page section that isn't wrapped in a Card (e.g. above a Table). */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-serif text-lg font-semibold text-ink">{children}</h2>;
}
