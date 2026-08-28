'use client';

import { useState, useTransition } from 'react';
import { previewBatchAction, runBatchAction } from '@/app/actions/batch';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { confirmLabel, resultSentence, reviewWarnings, tally, tallySentence } from '@/lib/domain/batch';
import type { BatchPreview, BatchResult } from '@/lib/domain/batch';
import { BatchReview } from './BatchReview';

/**
 * MARKING A WEEK'S CHECK-INS READ, TOGETHER.
 *
 * The queue had seventeen individual "mark as read" buttons and no way to do
 * them at once, while the roster had had exactly that since Slice 10. This
 * bar is not a second batch system: it calls the same two server actions the
 * roster's bar calls, gets the same `BatchPreview` back, renders it through
 * the same `BatchReview`, and reports the result with the same sentence.
 *
 * It offers one action, because one is what a queue of check-ins needs.
 * There is deliberately no bulk reply — answering eleven athletes with one
 * sentence is not answering eleven athletes.
 */
export function CheckInBatchBar({ chosen, onClear, onRemove }: {
  chosen: { athleteId: string; athleteName: string }[];
  onClear: () => void;
  onRemove: (athleteId: string) => void;
}) {
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!chosen.length && !result) return null;

  const ids = chosen.map((c) => c.athleteId);
  const params = { action: 'acknowledge_checkin' as const };

  if (result) {
    return (
      <Panel className="sticky bottom-4 z-20 mt-6 p-5" edge>
        <p role="status" className="text-[14px] text-ink">{resultSentence(result)}</p>
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => { setResult(null); onClear(); }}>
            Done
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={`${preview ? '' : 'sticky bottom-4'} z-20 mt-6 p-5`} edge>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="im-micro">{chosen.length} selected</p>
          <p className="mt-1.5 min-w-0 break-words text-[12.5px] leading-relaxed text-ink-tertiary">
            {chosen.slice(0, 8).map((c) => c.athleteName).join(', ')}
            {chosen.length > 8 && ` and ${chosen.length - 8} more`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
          {!preview && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => start(async () => {
                setError(null);
                const res = await previewBatchAction(ids, params);
                if (res.ok) setPreview(res.preview);
                else setError(res.message);
              })}
            >
              {pending ? 'Checking…' : `Mark ${chosen.length} read`}
            </Button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-[13px] text-status-missed">{error}</p>}

      {preview && (
        <div className="mt-5">
          <BatchReview
            preview={preview}
            onRemove={(athleteId) => {
              onRemove(athleteId);
              setPreview({ ...preview, rows: preview.rows.filter((r) => r.athleteId !== athleteId) });
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button
              size="sm"
              disabled={pending || tally(preview).willChange === 0}
              onClick={() => start(async () => {
                const res = await runBatchAction(
                  preview.rows.filter((r) => r.outcome === 'applied').map((r) => r.athleteId),
                  params);
                if (res.ok) { setPreview(null); setResult(res.result); }
                else setError(res.message);
              })}
            >
              {pending ? 'Marking…' : confirmLabel('acknowledge_checkin', tally(preview))}
            </Button>
            <p className="text-[12.5px] text-ink-secondary">
              {tallySentence(tally(preview), reviewWarnings(preview))}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Back</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
