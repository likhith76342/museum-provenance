'use client';

import Link from 'next/link';
import { useState } from 'react';

type Hit = { report_id: number; accession_number: string; report_date: string; score: number; snippet: string };
type Column = { hits: Hit[] | null; error: string | null };

async function search(q: string, mode: 'keyword' | 'semantic'): Promise<Hit[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.results as Hit[];
}

/** Bold the <b>…</b> parts of a ts_headline snippet WITHOUT dangerouslySetInnerHTML:
 *  split on the tags and render alternate pieces in <strong>; React escapes everything else. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/<\/?b>/);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

function Results({ title, subtitle, col, highlight }: { title: string; subtitle: string; col: Column | null; highlight: boolean }) {
  return (
    <div className="rounded border p-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-gray-500">{subtitle}</p>
      {col === null ? (
        <p className="text-gray-400">Results appear here.</p>
      ) : col.error ? (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{col.error}</p>
      ) : col.hits && col.hits.length === 0 ? (
        <p className="text-gray-500">No results.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {col.hits?.map((h) => (
            <li key={h.report_id} className="border-b pb-2">
              <p>
                <Link href={`/reports/${h.report_id}`} className="underline">Report #{h.report_id}</Link> · {h.accession_number} · {h.report_date}{' '}
                <span className="text-xs text-gray-500">score {h.score}</span>
              </p>
              <p className="text-gray-700">{highlight ? <Highlighted text={h.snippet} /> : h.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SearchBox() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState<Column | null>(null);
  const [semantic, setSemantic] = useState<Column | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) {
      setMessage('Type at least 2 characters');
      return;
    }
    setMessage(null);
    setBusy(true);
    // allSettled: if the embedding service is down, keyword results still show
    const [k, s] = await Promise.allSettled([search(query, 'keyword'), search(query, 'semantic')]);
    setKeyword(k.status === 'fulfilled' ? { hits: k.value, error: null } : { hits: null, error: String(k.reason?.message ?? k.reason) });
    setSemantic(s.status === 'fulfilled' ? { hits: s.value, error: null } : { hits: null, error: String(s.reason?.message ?? s.reason) });
    setBusy(false);
  }

  return (
    <div className="text-sm">
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='e.g. bronze disease, "no flaking", paint is coming off'
          className="w-full max-w-xl rounded border p-1.5"
        />
        <button disabled={busy} className="rounded bg-black px-4 py-1.5 text-white disabled:opacity-50">
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      {message && <p className="mb-3 text-red-800">{message}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Results title="Keyword (full-text)" subtitle="Exact words, stemmed. Fast, but blind to meaning and negation." col={keyword} highlight />
        <Results title="Meaning (embeddings)" subtitle="Nearest reports by vector similarity (cosine)." col={semantic} highlight={false} />
      </div>
    </div>
  );
}
