'use client';

import Link from 'next/link';
import { type FormEvent, useRef, useState } from 'react';
import { Accession } from '@/components/ui/Accession';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormError } from '@/components/ui/FormError';
import { ApiError } from '@/lib/fetch-json';

type Hit = { report_id: number; accession_number: string; report_date: string; score: number; snippet: string };
type Column = { hits: Hit[] | null; error: unknown };

const EXAMPLES = ['bronze disease', 'no flaking', 'paint is coming off'];

// Same look as the kit's inputClass, but larger for the main search box.
const bigInput =
  'block w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-base text-ink shadow-sm ' +
  'placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

async function search(q: string, mode: 'keyword' | 'semantic'): Promise<Hit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.detail || undefined);
  return data.results as Hit[];
}

/** Bold the <b>…</b> parts of a ts_headline snippet WITHOUT dangerouslySetInnerHTML:
 *  split on the tags and render alternate pieces in <strong>; React escapes everything else. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/<\/?b>/);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-ink">{p}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

function Results({
  title,
  subtitle,
  scoreLabel,
  col,
  query,
  highlight,
}: {
  title: string;
  subtitle: string;
  scoreLabel: string;
  col: Column | null;
  query: string;
  highlight: boolean;
}) {
  return (
    <Card title={title}>
      <p className="-mt-2 mb-4 text-xs text-stone-500">{subtitle}</p>
      {col === null ? (
        <EmptyState>Run a search to see results.</EmptyState>
      ) : col.error ? (
        <FormError error={col.error} />
      ) : col.hits && col.hits.length === 0 ? (
        <EmptyState>{`No reports matched "${query}".`}</EmptyState>
      ) : (
        <ol className="divide-y divide-stone-100">
          {col.hits?.map((h) => (
            <li key={h.report_id} className="py-3 first:pt-0 last:pb-0">
              <p className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link href={`/reports/${h.report_id}`} className="tabular-nums text-accent hover:underline">
                  Report #{h.report_id}
                </Link>
                <Accession number={h.accession_number} />
                <span className="tabular-nums text-stone-500">{h.report_date}</span>
                <span className="tabular-nums text-xs text-stone-500">
                  {scoreLabel} {h.score}
                </span>
              </p>
              <p className="text-sm text-stone-700">{highlight ? <Highlighted text={h.snippet} /> : h.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function SearchBox() {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<Column | null>(null);
  const [semantic, setSemantic] = useState<Column | null>(null);
  const latest = useRef(0); // ignore the results of an older search that finishes late

  async function runSearch(raw: string) {
    const query = raw.trim();
    if (query.length < 2) {
      setMessage('Type at least 2 characters.');
      return;
    }
    setMessage(null);
    setBusy(true);
    setAsked(query);
    const id = ++latest.current;
    // allSettled: if the embedding service is down, keyword results still show
    const [k, s] = await Promise.allSettled([search(query, 'keyword'), search(query, 'semantic')]);
    if (id !== latest.current) return;
    setKeyword(k.status === 'fulfilled' ? { hits: k.value, error: null } : { hits: null, error: k.reason });
    setSemantic(s.status === 'fulfilled' ? { hits: s.value, error: null } : { hits: null, error: s.reason });
    setBusy(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void runSearch(q);
  }

  function fillExample(text: string) {
    setQ(text);
    void runSearch(text);
  }

  return (
    <div className="space-y-6">
      <div>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Describe what you are looking for…"
            aria-label="Search condition reports"
            className={bigInput}
          />
          <Button disabled={busy} className="sm:px-6">{busy ? 'Searching…' : 'Search'}</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <Button key={ex} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => fillExample(ex)}>
              {ex}
            </Button>
          ))}
        </div>
        {message && <p role="alert" className="mt-2 text-sm text-red-800">{message}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Results
          title="Keyword (full-text, GIN index)"
          subtitle="Matches the words you typed, after stemming. Fast, but blind to meaning and negation."
          scoreLabel="rank"
          col={keyword}
          query={asked}
          highlight
        />
        <Results
          title="Meaning (embeddings, HNSW index)"
          subtitle="Finds the reports closest in meaning, by cosine similarity of their embeddings."
          scoreLabel="similarity"
          col={semantic}
          query={asked}
          highlight={false}
        />
      </div>

      <p className="text-sm text-stone-500">
        {"Keyword search matches words; semantic search matches meaning, so 'no flaking' also finds reports that do have flaking in the keyword column."}
      </p>
    </div>
  );
}
