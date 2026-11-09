import { requireUser } from '@/lib/auth';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  return (
    <div>
      {denied && <p className="mb-4 text-sm text-red-600">You don&apos;t have access to that page.</p>}
      <p>
        Welcome, {user.full_name} ({user.role})
      </p>
    </div>
  );
}
