'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { sendJson } from '@/lib/fetch-json';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await sendJson('/api/auth/logout', 'POST', {});
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout}>
      Log out
    </Button>
  );
}
