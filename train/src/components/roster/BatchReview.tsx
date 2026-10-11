'use client';

import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { reviewWarnings } from '@/lib/domain/batch';
import type { BatchPreview, BatchPreviewRow, ReviewWarnings } from '@/lib/domain/batch';

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
 *
 * Slice 14 changed where they are shown, not what they say. Fourteen athletes
 * used to carry the same four warnings, printed fourteen times — 56 lines for
 * 4 facts, under a summary that said "14 with warnings" and left the coach no
 * way to tell whether one of them had a problem the others did not. What every
 * athlete shares is now stated once at the top; whoever differs is named
 * immediately below it, before any per-athlete row.
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
  const warnings = reviewWarnings(preview);
  const [openRows, setOpenRows] = useState(false);
  const sharedSet = new Set(warnings.shared.map((g) => g.detail));

  // The review is the last screen before a destructive change, and it renders
  // below the whole roster — 4,540px down at forty athletes. A coach who asks
  // for it should be looking at it, not hunting for it.
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  return (
    <div ref={top} className="grid gap-4 scroll-mt-4">
      {(warnings.shared.length > 0 || warnings.differences.length > 0) && (
        <WarningSummary warnings={warnings} />
      )}

      <Panel className="p-0" edge>
        <button
          type="button"
          onClick={() => setOpenRows(!openRows)}
          aria-expanded={openRows}
          aria-controls="batch-review-rows"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:text-mint focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green sm:px-5"
        >
          <span className="im-mono text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">
            Athlete by athlete
          </span>
          <span className="im-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
            {openRows ? 'Hide' : `${preview.rows.length} ${preview.rows.length === 1 ? 'row' : 'rows'}`}
          </span>
        </button>

        <ul id="batch-review-rows" hidden={!openRows} className="divide-y divide-hairline border-t border-hairline">
          {preview.rows.map((row) => (
            <li key={row.athleteId}>
              {/* the shared warnings are stated above; the row shows what is
                  particular to this athlete, so nothing is printed twice */}
              <Row row={row} shared={sharedSet} onRemove={() => onRemove(row.athleteId)} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/**
 * What everyone has, and who does not match.
 *
 * The order is the point: a warning one athlete carries is the reason this
 * screen exists, so it sits above the four that thirteen of them share.
 */
function WarningSummary({ warnings }: { warnings: ReviewWarnings }) {
  return (
    <Panel className="p-5">
      {warnings.differences.length > 0 && (
        <div className="mb-5">
          <p className="im-micro text-amber">
            {warnings.exceptions.length === 1
              ? `${warnings.exceptions[0].athleteName} is not like the others`
              : warnings.exceptions.length > 1
                ? `${warnings.exceptions.length} athletes are not like the others`
                : 'Not true of everyone'}
          </p>
          <ul className="mt-3 grid gap-3">
            {warnings.differences.map((g) => (
              <li key={g.detail} className="border-l-2 border-amber pl-3">
                <p className="im-mono text-[10px] uppercase tracking-[0.12em] text-amber">
                  {g.athleteNames.length <= 3
                    ? g.athleteNames.join(', ')
                    : `${g.athleteNames.slice(0, 3).join(', ')} and ${g.athleteNames.length - 3} more`}
                  {' · '}
                  {g.athleteNames.length} of {warnings.cohort}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-body">{g.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.shared.length > 0 && (
        <div>
          <p className="im-micro">
            {warnings.shared.length === 1 ? 'True of' : `${warnings.shared.length} things true of`}
            {' '}all {warnings.cohort}
          </p>
          <ul className="mt-3 grid gap-1.5">
            {warnings.shared.map((g) => (
              <li key={g.detail} className="flex min-w-0 items-baseline gap-2.5">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber" />
                <span className="min-w-0 break-words text-[13px] leading-relaxed text-ink-secondary">
                  {g.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Row({ row, shared, onRemove }: {
  row: BatchPreviewRow;
  /** Stated once above. Not repeated on every row. */
  shared: ReadonlySet<string>;
  onRemove: () => void;
}) {
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

            {/* shown, never acted on — and only what is theirs alone, since
                what the whole batch shares is stated once at the top */}
            {row.warnings.filter((w) => !shared.has(w)).length > 0 && (
              <ul className="mt-2 grid gap-1">
                {row.warnings.filter((w) => !shared.has(w)).map((w) => (
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
