import RegisterArtifactForm from '@/components/RegisterArtifactForm';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireUser } from '@/lib/auth';
import { EDITORS } from '@/lib/types';

export default async function NewArtifactPage() {
  await requireUser(EDITORS);
  return (
    <div>
      <PageHeader
        title="Register artifact"
        subtitle="Add a new object to the catalogue. The database checks every rule before it is saved."
      />
      <Card className="max-w-3xl">
        <RegisterArtifactForm />
      </Card>
    </div>
  );
}
