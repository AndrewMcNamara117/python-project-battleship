'use client';

import { useState, useTransition } from 'react';
import { previewBatchAction, runBatchAction } from '@/app/actions/batch';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { confirmLabel, resultSentence, tally, tallySentence } from '@/lib/domain/batch';
import { addDays, startOfWeek } from '@/lib/domain/dates';
import type { BatchAction, BatchParams, BatchPreview, BatchResult } from '@/lib/domain/batch';
import { BatchReview } from './BatchReview';

/**
 * ACTING ON A CHECK-IN WITHOUT LEAVING IT.
 *
 * The audit found that going from a flagged check-in to a changed programme
 * cost nine steps across two pages, and that the athlete's own words were off
 * screen by the time the coach made the change. This closes that seam and
 * nothing more: it is the same preview-then-apply contract as the roster's
 * batch bar, aimed at one athlete, rendered inside the check-in card so what
 * they wrote stays visible while the coach decides.
 *
 * There is no separate check-in adaptation logic. This calls exactly the same
 * two server actions the batch bar does, with a selection of one.
 *
 * FORGE is not involved. Nothing here suggests a change, ranks one, or
 * pre-fills a percentage from the athlete's scores — the coach reads the
 * check-in and decides.
 */

const PERCENTAGES = [70, 80, 90];
const SHIFTS = [1, 2, 3, 7];

export function CheckInAdapt({
  athleteId,
  athleteName,
  weekStart,
}: {
  athleteId: string;
  athleteName: string;
  /** The week the athlete wrote about. The change defaults to the week ahead. */
  weekStart: string;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Extract<BatchAction, 'scale_volume' | 'shift_sessions'>>('scale_volume');
  const [percent, setPercent] = useState(90);
  const [days, setDays] = useState(1);
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // the week after the one they wrote about — you cannot change a week that
  // has already happened, and the check-in is about the week just gone
  const from = addDays(startOfWeek(weekStart), 7);
  const to = addDays(from, 6);

  const params = (): BatchParams =>
    action === 'scale_volume'
      ? { action, from, to, factor: percent / 100 }
      : { action, from, to, days };

  const review = () => {
    setError(null);
    start(async () => {
      const res = await previewBatchAction([athleteId], params());
      if (!res.ok) { setError(res.message); setPreview(null); return; }
      setPreview(res.preview);
    });
  };

  const apply = () => {
    start(async () => {
      const res = await runBatchAction([athleteId], params());
      if (!res.ok) { setError(res.message); return; }
      setResult(res.result);
      setPreview(null);
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Adjust next week
      </Button>
    );
  }

  const t = preview ? tally(preview) : null;

  return (
    <div className="rounded-xs border border-hairline-strong p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="im-micro">Next week for {athleteName}</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setPreview(null); setResult(null); }}
          className="im-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary hover:text-mint"
        >
          Close
        </button>
      </div>

      {!result && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ['scale_volume', 'Adjust volume'],
              ['shift_sessions', 'Shift days'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setAction(key); setPreview(null); }}
                aria-pressed={action === key}
                className={`rounded-xs border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors ${
                  action === key
                    ? 'border-mint bg-mint/10 text-mint'
                    : 'border-hairline-strong text-ink-secondary hover:border-mint hover:text-mint'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end">
            {action === 'scale_volume' ? (
              <Field label="Prescribed distance">
                {(p) => (
                  <Select {...p} value={percent}
                    onChange={(e) => { setPercent(Number(e.target.value)); setPreview(null); }}>
                    {PERCENTAGES.map((n) => <option key={n} value={n}>{n}%</option>)}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Move sessions">
                {(p) => (
                  <Select {...p} value={days}
                    onChange={(e) => { setDays(Number(e.target.value)); setPreview(null); }}>
                    {SHIFTS.map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'} later</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Button variant="ghost" size="sm" onClick={review} disabled={pending}>
              {pending && !preview ? 'Checking…' : 'Review'}
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-bold text-status-missed">{error}</p>
      )}

      {preview && t && (
        <div className="mt-4">
          <BatchReview preview={preview} onRemove={() => setPreview(null)} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={apply} disabled={pending || t.willChange === 0}>
              {pending ? 'Applying…' : confirmLabel(preview.action, t)}
            </Button>
            <p className="text-[12px] text-ink-secondary">{tallySentence(t)}</p>
          </div>
        </div>
      )}

      {result && (
        <p role="status" className="mt-3 text-[13px] text-mint">
          {resultSentence(result)} {result.rows[0]?.detail}
        </p>
      )}
    </div>
  );
}
