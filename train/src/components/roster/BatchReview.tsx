'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import type { BatchPreview, BatchPreviewRow } from '@/lib/domain/batch';

/**
 * WHAT THIS WOULD DO, ATHLETE BY ATHLETE.
 *
 * The part of a batch that must not be a spinner. Every athlete gets a row
 * carrying their own conflicts — the ones Slice 4 already computes for a
 * single assignment, unchanged — so a coach approves a specific set of
 * consequences rather than a number.
 *
 * Warnings are shown and never resolved. Nothing here moves a session to fit
 * an athlete's stated availability or quietly drops one that does not fit;
 * that is the coach's call, and it was the rule before batches existed.
 */

const TONE: Record<BatchPreviewRow['outcome'], { dot: string; label: string; text: string }> = {
  applied: { dot: 'bg-mint', label: 'Will change', text: 'text-mint' },
  skipped: { dot: 'bg-hairline-strong', label: 'Nothing to do', text: 'text-ink-tertiary' },
  blocked: { dot: 'bg-status-missed', label: 'Blocked', text: 'text-status-missed' },
  unauthorised: { dot: 'bg-status-missed', label: 'Not yours', text: 'text-status-missed' },
};

export function BatchReview({
  preview,
  onRemove,
}: {
  preview: BatchPreview;
  onRemove: (athleteId: string) => void;
}) {
  return (
    <Panel className="p-0" edge>
      <ul className="divide-y divide-hairline">
        {preview.rows.map((row) => (
          <li key={row.athleteId}>
            <Row row={row} onRemove={() => onRemove(row.athleteId)} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Row({ row, onRemove }: { row: BatchPreviewRow; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[row.outcome];
  const detail = row.volume ?? row.shift ?? null;

  return (
    <div className="p-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${tone.dot}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[14px] font-semibold text-ink">{row.athleteName}</p>
              <span className={`im-mono text-[10px] uppercase tracking-[0.12em] ${tone.text}`}>
                {tone.label}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{row.summary}</p>

            {/* shown, never acted on */}
            {row.warnings.length > 0 && (
              <ul className="mt-2 grid gap-1">
                {row.warnings.map((w) => (
                  <li key={w} className="text-[12.5px] leading-relaxed text-amber">{w}</li>
                ))}
              </ul>
            )}

            {row.blockers.length > 1 && (
              <ul className="mt-2 grid gap-1">
                {row.blockers.slice(1).map((b) => (
                  <li key={b} className="text-[12.5px] leading-relaxed text-status-missed">{b}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {detail && detail.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="im-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary hover:text-mint"
            >
              {open ? 'Hide' : `${detail.length} sessions`}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="im-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary hover:text-status-missed"
          >
            Remove
          </button>
        </div>
      </div>

      {/* the session-by-session detail, for the coach who wants to check */}
      {open && detail && (
        <ul className="mt-3 grid gap-1 border-t border-hairline pt-3">
          {detail.map((s) => (
            <li key={s.sessionId} className="flex flex-wrap items-baseline gap-2 text-[12px]">
              <span className={`im-mono text-[10px] uppercase tracking-[0.1em] ${
                s.action === 'blocked' ? 'text-status-missed'
                  : s.action === 'keep' ? 'text-ink-tertiary' : 'text-mint'}`}>
                {s.action}
              </span>
              <span className="text-ink-body">{s.name}</span>
              <span className="text-ink-tertiary">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
