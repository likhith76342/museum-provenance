'use client';

import { useRouter } from 'next/navigation';
import { sendJson } from '@/lib/fetch-json';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await sendJson('/api/auth/logout', 'POST', {});
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={logout} className="rounded border px-2 py-1 text-sm">
      Log out
    </button>
  );
}
