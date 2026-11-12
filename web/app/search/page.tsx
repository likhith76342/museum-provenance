import SearchBox from '@/components/SearchBox';
import { requireUser } from '@/lib/auth';

export default async function SearchPage() {
  await requireUser();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Search condition reports</h1>
      <SearchBox />
    </div>
  );
}
