import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import type { SessionUser } from '@/lib/types';

export default function Nav({ user }: { user: SessionUser }) {
  return (
    <nav className="flex items-center gap-4 border-b p-4 text-sm">
      <Link href="/">Home</Link>
      <Link href="/artifacts">Artifacts</Link>
      <Link href="/flags">Anomaly flags</Link>
      <Link href="/search">Search reports</Link>
      {/* Curators only: admins have no curator profile to file a report under */}
      {user.role === 'curator' && <Link href="/reports/new">File a report</Link>}
      {user.role === 'admin' && <Link href="/admin/users">Users</Link>}
      <span className="ml-auto">
        {user.full_name} ({user.role})
      </span>
      <LogoutButton />
    </nav>
  );
}
