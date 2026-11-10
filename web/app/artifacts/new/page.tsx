import RegisterArtifactForm from '@/components/RegisterArtifactForm';
import { requireUser } from '@/lib/auth';
import { EDITORS } from '@/lib/types';

export default async function NewArtifactPage() {
  await requireUser(EDITORS);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Register artifact</h1>
      <RegisterArtifactForm />
    </div>
  );
}
