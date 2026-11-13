import { LinkButton } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-sm text-stone-400">404</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink">Not in the collection</h1>
      <p className="mt-3 text-sm text-stone-600">
        We couldn&apos;t find that page or record. It may have been mistyped, or it was never catalogued.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <LinkButton href="/">Go home</LinkButton>
        <LinkButton href="/artifacts" variant="secondary">Browse artifacts</LinkButton>
      </div>
    </div>
  );
}
