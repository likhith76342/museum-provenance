'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GRADE_LABELS } from '@/lib/condition';
import { sendJson } from '@/lib/fetch-json';

type Artifact = { accession_number: string; title: string };
type Flag = {
  flag_id: number;
  flag_type: string;
  similarity_score: number | null;
  compared_report_id: number | null;
  compared_accession: string | null;
};
type Result = { report_id: number; flags: Flag[] };

export default function NewReportForm({ artifacts, initialAccession }: { artifacts: Artifact[]; initialAccession: string }) {
  const [accession, setAccession] = useState(artifacts.some((a) => a.accession_number === initialAccession) ? initialAccession : '');
  const [date, setDate] = useState('');
  const [grade, setGrade] = useState('4');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Today in the BROWSER's local date, set after mount so server and client HTML match
  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-CA'));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await sendJson<Result>('/api/reports', 'POST', {
        accession_number: accession,
        report_date: date,
        condition_grade: Number(grade),
        report_text: text,
      });
      setResult(r);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl text-sm">
      {result && (
        <div className="mb-4 rounded border border-green-600 bg-green-50 p-3">
          <p className="font-medium">Report #{result.report_id} saved and embedded.</p>
          {result.flags.length > 0 ? (
            <div className="mt-2 rounded border border-red-300 bg-red-50 p-2">
              <p className="font-medium text-red-800">
                {result.flags.length} anomaly flag{result.flags.length > 1 ? 's' : ''} raised:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {result.flags.map((f) => (
                  <li key={f.flag_id}>
                    <strong>{f.flag_type}</strong>
                    {f.similarity_score != null && <> (similarity {f.similarity_score.toFixed(2)})</>}
                    {f.compared_report_id != null && (
                      <> vs report #{f.compared_report_id}{f.compared_accession ? ` of ${f.compared_accession}` : ''}</>
                    )}{' '}
                    — <Link href="/flags" className="underline">review on the flags page</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-gray-700">No anomaly flags raised.</p>
          )}
          <p className="mt-2"><Link href={`/reports/${result.report_id}`} className="underline">View the report →</Link></p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          Artifact
          <select required value={accession} onChange={(e) => setAccession(e.target.value)} className="rounded border p-1.5">
            <option value="">Choose an artifact…</option>
            {artifacts.map((a) => (
              <option key={a.accession_number} value={a.accession_number}>{a.accession_number} — {a.title}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-4">
          <label className="flex flex-col gap-1">
            Report date
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="rounded border p-1.5" />
          </label>
          <label className="flex flex-col gap-1">
            Condition grade
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded border p-1.5">
              {[5, 4, 3, 2, 1].map((g) => (
                <option key={g} value={g}>{g} — {GRADE_LABELS[g]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          Report text (min 30 characters)
          <textarea
            required
            minLength={30}
            maxLength={5000}
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded border p-1.5"
          />
          <span className="text-xs text-gray-500">{text.trim().length} characters</span>
        </label>
        {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{error}</p>}
        <div>
          <button disabled={busy} className="rounded bg-black px-4 py-1.5 text-white disabled:opacity-50">
            {busy ? 'Saving and embedding…' : 'File report'}
          </button>
        </div>
      </form>
    </div>
  );
}
