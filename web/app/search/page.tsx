import SearchBox from '@/components/SearchBox';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireUser } from '@/lib/auth';

export default async function SearchPage() {
  await requireUser();
  return (
    <div>
      <PageHeader
        title="Search condition reports"
        subtitle="The same query, answered two ways: by matching words and by matching meaning."
      />
      <SearchBox />
    </div>
  );
}
