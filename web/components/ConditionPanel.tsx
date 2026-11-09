import type { SessionUser } from '@/lib/types';

// Placeholder: Monish replaces this with condition history, similar reports and flags.
export default async function ConditionPanel({ accession }: { accession: string; user: SessionUser }) {
  return (
    <section className="mt-8 rounded border p-4 text-sm text-gray-500">
      Condition reports for {accession} will appear here.
    </section>
  );
}
