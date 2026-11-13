'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Nav links with the current section highlighted. */
export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-2.5 flex flex-wrap gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              active ? 'bg-accent-soft font-medium text-accent' : 'text-stone-600 hover:bg-stone-100 hover:text-ink'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
