import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import NavLinks from '@/components/NavLinks';
import { RoleBadge } from '@/components/ui/badges';
import type { SessionUser } from '@/lib/types';

export default function Nav({ user }: { user: SessionUser }) {
  const links = [
    { href: '/', label: 'Home' },
    { href: '/artifacts', label: 'Artifacts' },
    { href: '/flags', label: 'Anomaly flags' },
    { href: '/search', label: 'Search reports' },
    // Curators only: admins have no curator profile to file a report under
    ...(user.role === 'curator' ? [{ href: '/reports/new', label: 'File a report' }] : []),
    ...(user.role === 'admin' ? [{ href: '/admin/users', label: 'Users' }] : []),
  ];

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-ink">
          Coromandel Heritage Museum
        </Link>
        <div className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
          <NavLinks links={links} />
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-stone-700 sm:inline">{user.full_name}</span>
          <RoleBadge role={user.role} />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
