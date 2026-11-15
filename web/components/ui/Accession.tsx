import Link from 'next/link';

/** Accession number in monospace, linking to the artifact page. */
export function Accession({ number, link = true }: { number: string; link?: boolean }) {
  const cls = 'whitespace-nowrap font-mono text-[0.8125rem]';
  if (!link) return <span className={`${cls} text-stone-700`}>{number}</span>;
  return (
    <Link href={`/artifacts/${encodeURIComponent(number)}`} className={`${cls} text-accent hover:underline`}>
      {number}
    </Link>
  );
}
