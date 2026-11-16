'use client';

import { type FormEvent, useState } from 'react';
import { Accession } from '@/components/ui/Accession';
import { FlagTypeBadge } from '@/components/ui/badges';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, inputClass } from '@/components/ui/Field';
import { FormError } from '@/components/ui/FormError';
import { Notice } from '@/components/ui/Notice';
import Link from 'next/link';
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

const MIN_CHARS = 30;

export default function NewReportForm({
  artifacts,
  initialAccession,
  today,
}: {
  artifacts: Artifact[];
  initialAccession: string;
  today: string;
}) {
  const [accession, setAccession] = useState(artifacts.some((a) => a.accession_number === initialAccession) ? initialAccession : '');
  const [date, setDate] = useState(today);
  const [grade, setGrade] = useState('4');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: FormEvent) {
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
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const len = text.trim().length;

  return (
    <div className="max-w-3xl space-y-6">
      {result && (
        <div className="space-y-4">
          <Notice tone="good" title={`Report #${result.report_id} saved and embedded`}>
            <Link href={`/reports/${result.report_id}`} className="underline">View the report</Link>
          </Notice>

          {result.flags.length > 0 ? (
            <section className="rounded-lg border-2 border-red-300 bg-red-50 p-5 shadow-sm">
              <h2 className="mb-3 font-serif text-lg font-semibold text-red-900">
                {result.flags.length} anomaly {result.flags.length > 1 ? 'flags' : 'flag'} raised
              </h2>
              <ul className="space-y-3">
                {result.flags.map((f) => (
                  <li key={f.flag_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-red-950">
                    <FlagTypeBadge type={f.flag_type} />
                    {f.similarity_score != null && (
                      <span className="tabular-nums">similarity {f.similarity_score.toFixed(2)}</span>
                    )}
                    {f.compared_report_id != null && (
                      <span className="inline-flex flex-wrap items-center gap-x-1.5">
                        compared with report
                        <Link href={`/reports/${f.compared_report_id}`} className="tabular-nums underline">
                          #{f.compared_report_id}
                        </Link>
                        {f.compared_accession && <Accession number={f.compared_accession} />}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <LinkButton href="/flags">Review on the flags page</LinkButton>
              </div>
            </section>
          ) : (
            <Notice tone="info">No anomaly flags were raised.</Notice>
          )}
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Artifact">
            <select required value={accession} onChange={(e) => setAccession(e.target.value)} className={inputClass}>
              <option value="">Choose an artifact…</option>
              {artifacts.map((a) => (
                <option key={a.accession_number} value={a.accession_number}>
                  {a.accession_number} — {a.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Report date">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Condition grade">
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>
                {[5, 4, 3, 2, 1].map((g) => (
                  <option key={g} value={g}>
                    {g} — {GRADE_LABELS[g]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Report text"
            hint={
              len < MIN_CHARS
                ? `${len} characters (at least ${MIN_CHARS} needed)`
                : `${len} characters`
            }
          >
            <textarea
              required
              minLength={MIN_CHARS}
              maxLength={5000}
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={inputClass}
            />
          </Field>

          <FormError error={error} />

          <Button disabled={busy}>{busy ? 'Embedding and saving…' : 'File report'}</Button>
        </form>
      </Card>
    </div>
  );
}
