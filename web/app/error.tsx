'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button, LinkButton } from '@/components/ui/Button';

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 text-sm text-stone-600">
        The page couldn&apos;t be loaded. This is usually temporary: try again, or go back home.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-stone-400">Reference: {digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <LinkButton href="/" variant="secondary">Go home</LinkButton>
      </div>
    </div>
  );
}
