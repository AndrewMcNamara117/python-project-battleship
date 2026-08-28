'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import {
  applyQueueFilter, queueCounts, queueSignals, QUEUE_FILTER_LABELS, QUEUE_FILTERS,
  rankQueue, waitedFor,
} from '@/lib/domain/roster';
import type { QueueCheckIn, QueueFilter, Severity, Signal } from '@/lib/domain/roster';
import {
  allSelected, deselectAll, EMPTY_SELECTION, isSelected, reconcile, selectAll, toggle,
} from '@/lib/domain/batch';
import type { Selection } from '@/lib/domain/batch';
import { formatDayMonth } from '@/lib/domain/dates';
import { CheckInResponder } from '@/app/coach/athletes/[id]/CoachControls';
import { CheckInAdapt } from './CheckInAdapt';
import { MarkCheckInRead } from './MarkCheckInRead';
import { CheckInBatchBar } from './CheckInBatchBar';

/**
 * THE CHECK-IN QUEUE.
 *
 * This is the one screen where a coach reads what an athlete actually wrote
 * about their week — what went well, what felt hard, how confident they are
 * about the next block. The roster carries the signals; it does not carry
 * their words. That is why this page exists and why it was not deleted.
 *
 * What it lacked was everything the roster learned between Slices 9 and 14.
 * Eighteen check-ins rendered in full — seven scores, six written answers and
 * an open reply box each — came to 12.7 screens, with seventeen individual
 * "mark as read" buttons and no way to filter. Clearing a week meant
 * seventeen clicks and a scroll.
 *
 * So: the same filters the roster uses, by the same definitions; Slice 9's
 * selection and runner for marking read together; and the card collapsed to
 * what a coach triages on, with everything else one keystroke away — in
 * place, never on another page.
 *
 * What is deliberately absent: a bulk reply. Answering eleven athletes with
 * one sentence is not answering eleven athletes.
 */

const SEVERITY_DOT: Record<Severity, string> = {
  urgent: 'bg-status-missed',
  attention: 'bg-amber',
  information: 'bg-hairline-strong',
};

/** The scores worth reading at a glance: the ones the athlete put outside normal. */
const RAISED = (k: string, v: number) =>
  ((k === 'soreness' || k === 'fatigue' || k === 'stress') && v >= 8)
  || ((k === 'sleep' || k === 'motivation' || k === 'confidence') && v <= 3);

export interface QueueRow extends QueueCheckIn {
  scores: Record<string, number>;
  wentWell: string;
  feltDifficult: string;
  affectingTraining: string;
  confidenceNextWeek: string;
  forCoach: string;
  coachResponse: string | null;
}

export function CheckInQueue({ rows, now }: { rows: QueueRow[]; now: string }) {
  // Land on the first view that actually has something in it. Defaulting
  // flatly to "needs a reply" showed a coach an empty screen saying nothing
  // was waiting while nine unread check-ins sat one chip away — a queue that
  // looks clear when it is not is worse than a long one.
  const [filter, setFilter] = useState<QueueFilter>(() => {
    const counts = queueCounts(rows);
    return (QUEUE_FILTERS.find((f) => f !== 'all' && counts[f] > 0) ?? 'all');
  });
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [rawSelection, setSelection] = useState<Selection>(EMPTY_SELECTION);

  const counts = useMemo(() => queueCounts(rows), [rows]);
  const visible = useMemo(
    () => rankQueue(applyQueueFilter(rows, filter)) as QueueRow[],
    [rows, filter]);

  // Selection is by ATHLETE, because that is what the batch runner
  // authorises and applies against. Reconciling against the whole queue
  // rather than the filtered view means a coach who selects, filters, and
  // comes back still has the same athletes chosen.
  const selection = useMemo(
    () => reconcile(rawSelection, rows.map((c) => ({ athleteId: c.athleteId }))),
    [rawSelection, rows]);

  // Only check-ins nobody has read can be marked read; offering it for the
  // rest would be a button that does nothing.
  const markable = visible.filter((c) => !c.acknowledgedAt);
  const markableIds = markable.map((c) => c.athleteId);
  const everyMarkableChosen = markableIds.length > 0 && allSelected(selection, markableIds);
  const chosen = rows.filter((c) => isSelected(selection, c.athleteId) && !c.acknowledgedAt);

  const toggleOpen = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-2">
        {QUEUE_FILTERS.map((key) => {
          const active = filter === key;
          if (!counts[key] && !active && key !== 'all') return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={`rounded-xs border px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors ${
                active
                  ? 'border-mint bg-mint/10 text-mint'
                  : 'border-hairline-strong text-ink-secondary hover:border-mint hover:text-mint'
              }`}
            >
              {QUEUE_FILTER_LABELS[key]}
              <span className="ml-2 im-mono text-[10px] opacity-70">{counts[key]}</span>
            </button>
          );
        })}

        {markableIds.length > 0 && (
          <button
            type="button"
            onClick={() => setSelection(everyMarkableChosen
              ? deselectAll(selection, markableIds)
              : selectAll(selection, markableIds))}
            className="rounded-xs border border-hairline-strong px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-mint hover:text-mint"
          >
            {everyMarkableChosen ? 'Clear these' : `Select these ${markableIds.length}`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <Panel className="mt-6 p-8 text-center">
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            {filter === 'waiting'
              ? 'Nothing is waiting on a reply. That is the good outcome.'
              : 'No check-ins match that.'}
          </p>
        </Panel>
      ) : (
        <ul className="mt-6 grid gap-3" aria-label="Check-ins">
          {visible.map((c) => (
            <li key={c.id}>
              <QueueCard
                row={c}
                now={now}
                open={open.has(c.id)}
                onOpen={() => toggleOpen(c.id)}
                selected={isSelected(selection, c.athleteId)}
                onToggle={() => setSelection(toggle(selection, c.athleteId))}
              />
            </li>
          ))}
        </ul>
      )}

      <CheckInBatchBar
        chosen={chosen.map((c) => ({ athleteId: c.athleteId, athleteName: c.athleteName }))}
        onClear={() => setSelection(EMPTY_SELECTION)}
        onRemove={(id) => setSelection(toggle(selection, id))}
      />
    </>
  );
}

/**
 * One check-in.
 *
 * Collapsed, it carries what a coach triages on: who, how long it has sat,
 * what the check-in raised, the scores the athlete put outside normal, and —
 * always — anything they wrote about pain or addressed to their coach. Those
 * two are never folded away: they are the reason a coach opens this screen.
 *
 * Opened, it is the card as it was: every score, every written answer, the
 * reply box and the adaptation seam.
 */
function QueueCard({ row, now, open, onOpen, selected, onToggle }: {
  row: QueueRow;
  now: string;
  open: boolean;
  onOpen: () => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const signals: Signal[] = queueSignals(row);
  const raised = Object.entries(row.scores).filter(([k, v]) => RAISED(k, v));
  const waited = waitedFor(row.submittedAt, now);
  const panelId = `checkin-${row.id}-detail`;

  const written = [
    ['Went well', row.wentWell],
    ['Felt difficult', row.feltDifficult],
    ['Affecting training', row.affectingTraining],
    ['Confidence next week', row.confidenceNextWeek],
  ].filter(([, v]) => v) as [string, string][];

  const more = Object.keys(row.scores).length - raised.length + written.length;

  return (
    <Panel edge={row.attentionLevel !== 'none'} className={`min-w-0 p-5 ${selected ? 'border-mint/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-64 gap-3.5">
          {!row.acknowledgedAt && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              aria-label={`Select ${row.athleteName}`}
              className="mt-1 size-4.5 shrink-0 appearance-none rounded-[2px] border border-hairline-strong bg-slate transition-colors checked:border-mint checked:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {signals[0] && (
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[signals[0].severity]}`} />
              )}
              <Link
                href={`/coach/athletes/${row.athleteId}`}
                className="im-display text-[1.05rem] transition-colors hover:text-mint"
              >
                {row.athleteName}
              </Link>
              <span className="im-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
                week of {formatDayMonth(row.weekStart)} · {waited}
              </span>
              {row.respondedAt && <Badge tone="neutral">Answered</Badge>}
            </div>

            {/* what the check-in raises, in the roster's own words */}
            {signals.length > 0 && (
              <ul className="mt-2.5 grid gap-1.5">
                {signals.map((s) => (
                  <li key={s.kind} className="flex min-w-0 items-baseline gap-2.5">
                    <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[s.severity]}`} />
                    <span className="min-w-0 break-words text-[13px] leading-relaxed text-ink-body">
                      {s.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* the scores they put outside normal, said as numbers */}
            {raised.length > 0 && (
              <p className="mt-2 im-mono text-[11px] text-amber">
                {raised.map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${v}`).join(' · ')}
              </p>
            )}

            {/* Never folded away: a note addressed to the coach is the whole
                point of the box it was typed into. */}
            {row.forCoach && (
              <blockquote className="mt-3 border-l-2 border-hairline-strong pl-3 text-[13px] leading-relaxed text-ink-body">
                {row.forCoach}
              </blockquote>
            )}

            {more > 0 && (
              <button
                type="button"
                onClick={onOpen}
                aria-expanded={open}
                aria-controls={panelId}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xs text-[12px] text-ink-tertiary transition-colors hover:text-mint focus-visible:text-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
              >
                <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                <span>{open ? 'Show less' : `${more} more`}</span>
                <span className="sr-only"> of {row.athleteName}&apos;s check-in</span>
              </button>
            )}
          </div>
        </div>

        {/* Not shrink-0: MarkCheckInRead carries its own explanatory sentence
            and is 397px wide intrinsically, which pushed the card 48px past a
            390px viewport. It wraps under the content column instead. */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {!row.acknowledgedAt && (
            <MarkCheckInRead
              checkInId={row.id}
              athleteId={row.athleteId}
              flagged={row.attentionLevel === 'attention'}
            />
          )}
        </div>
      </div>

      <div id={panelId} hidden={!open}>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(row.scores).map(([k, v]) => (
            <div key={k}>
              <dt className="im-micro">{k.replace(/([A-Z])/g, ' $1')}</dt>
              <dd className={`im-mono mt-1 text-[15px] font-extrabold ${RAISED(k, v) ? 'text-amber' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>

        {written.length > 0 && (
          <div className="mt-5 grid gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
            {written.map(([label, value]) => (
              <div key={label}>
                <p className="im-micro">{label}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-body">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-hairline pt-4">
          <CheckInResponder checkInId={row.id} athleteId={row.athleteId} existing={row.coachResponse} />
        </div>

        {/* the seam Slice 9 found: change next week from here, with what the
            athlete wrote still on screen above */}
        <div className="mt-4">
          <CheckInAdapt
            athleteId={row.athleteId}
            athleteName={row.athleteName}
            weekStart={row.weekStart}
          />
        </div>
      </div>
    </Panel>
  );
}
