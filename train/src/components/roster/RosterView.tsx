'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import {
  applyFilter, FILTER_LABELS, filterCounts, partitionRoster, summariseToday,
} from '@/lib/domain/roster';
import type { RosterEntry, RosterFilter, RosterGroup, Severity } from '@/lib/domain/roster';
import { formatDayMonth } from '@/lib/domain/dates';
import {
  allSelected, deselectAll, EMPTY_SELECTION, isSelected, reconcile,
  selectAll, selectedEntries, toggle,
} from '@/lib/domain/batch';
import type { Selection } from '@/lib/domain/batch';
import { BatchBar } from './BatchBar';

/**
 * THE ROSTER
 *
 * The question this screen answers is "who should I look at first", and
 * everything on it earns its place against that. Signals say what is going on
 * in the words a coach would use, and each one leads to where they can act.
 *
 * There is no score. Iron Miles surfaces what it knows; the coach decides what
 * it means.
 */

const SEVERITY_DOT: Record<Severity, string> = {
  urgent: 'bg-status-missed',
  attention: 'bg-amber',
  information: 'bg-hairline-strong',
};

const FILTER_ORDER: RosterFilter[] = [
  'attention', 'checkins', 'missed', 'ending', 'races', 'no_training', 'all',
];

export function RosterView({ roster, today }: { roster: RosterEntry[]; today: string }) {
  const [filter, setFilter] = useState<RosterFilter>('attention');
  const [search, setSearch] = useState('');

  // Selection is deliberate and it is the coach's. It is never derived from a
  // filter at apply time — a selection stored as "everyone matching this"
  // changes underneath them between the review and the confirmation. It does
  // survive filtering, so four athletes chosen, then a filter, then back, are
  // still the same four.
  const [rawSelection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const selection = useMemo(() => reconcile(rawSelection, roster), [rawSelection, roster]);
  const chosen = useMemo(() => selectedEntries(selection, roster), [selection, roster]);

  const counts = useMemo(() => filterCounts(roster), [roster]);
  const visible = useMemo(() => applyFilter(roster, filter, search), [roster, filter, search]);

  // A backlog shared by half the squad is one fact, not fifteen rows. Grouping
  // it is what keeps the athlete whose long run went badly visible.
  const { individual, groups } = useMemo(
    () => (filter === 'attention' && !search
      ? partitionRoster(visible)
      : { individual: visible, groups: [] as RosterGroup[] }),
    [visible, filter, search]);
  const summary = useMemo(() => summariseToday(roster, today), [roster, today]);

  const visibleIds = visible.map((e) => e.athleteId);
  const everyVisibleChosen = allSelected(selection, visibleIds);

  return (
    <>
      <TodayStrip summary={summary} total={roster.length} />

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {FILTER_ORDER.map((key) => {
          const count = counts[key];
          const active = filter === key;
          // a filter with nothing behind it is noise, unless it is where you are
          if (!count && !active && key !== 'all') return null;
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
              {FILTER_LABELS[key]}
              <span className="ml-2 im-mono text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}

        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => setSelection(everyVisibleChosen
              ? deselectAll(selection, visibleIds)
              : selectAll(selection, visibleIds))}
            className="rounded-xs border border-hairline-strong px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-mint hover:text-mint"
          >
            {everyVisibleChosen ? 'Clear these' : `Select these ${visible.length}`}
          </button>
        )}

        <label className="ml-auto w-full sm:w-auto">
          <span className="sr-only">Search athletes</span>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an athlete"
            className="w-full sm:w-[14rem]"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <Panel className="mt-6 p-8 text-center">
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            {filter === 'attention' && !search
              ? 'Nobody needs you right now. That is the good outcome.'
              : 'No athletes match that.'}
          </p>
        </Panel>
      ) : (
        <>
          {groups.length > 0 && (
            <ul className="mt-6 grid gap-3" aria-label="Shared across the squad">
              {groups.map((group) => (
                <li key={group.kind}>
                  <GroupRow
                    group={group}
                    onShow={() => { setFilter('all'); setSearch(''); }}
                    onSelect={() => setSelection(
                      selectAll(selection, group.entries.map((e) => e.athleteId)))}
                  />
                </li>
              ))}
            </ul>
          )}

          {individual.length > 0 ? (
            <ul className="mt-3 grid gap-3" aria-label="Athletes">
              {individual.map((entry) => (
                <li key={entry.athleteId}>
                  <AthleteRow
                    entry={entry}
                    today={today}
                    selected={isSelected(selection, entry.athleteId)}
                    onToggle={() => setSelection(toggle(selection, entry.athleteId))}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Panel className="mt-3 p-6 text-center">
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Nobody else needs reading one at a time.
              </p>
            </Panel>
          )}
        </>
      )}

      <BatchBar
        selected={chosen}
        onClear={() => setSelection(EMPTY_SELECTION)}
        onRemove={(id) => setSelection(toggle(selection, id))}
      />
    </>
  );
}

/** One problem several athletes share, stated once and actionable once. */
function GroupRow({ group, onShow, onSelect }: {
  group: RosterGroup;
  onShow: () => void;
  onSelect: () => void;
}) {
  return (
    <Panel className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[group.severity]}`} />
            <p className="text-[14px] font-semibold text-ink">{group.detail}</p>
          </div>
          <p className="mt-1.5 min-w-0 break-words text-[12px] leading-relaxed text-ink-tertiary">
            {group.entries.slice(0, 6).map((e) => e.fullName).join(', ')}
            {group.entries.length > 6 && ` and ${group.entries.length - 6} more`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onShow}
            className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-secondary hover:text-mint"
          >
            Show them
          </button>
          {/* the row already knows who these athletes are; the coach should not
              have to find them one at a time to act on the thing they share */}
          <button
            type="button"
            onClick={onSelect}
            className="rounded-xs border border-hairline-strong px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-body transition-colors hover:border-mint hover:text-mint"
          >
            Select all {group.entries.length}
          </button>
        </div>
      </div>
    </Panel>
  );
}

/** Today and the week ahead, from the roster already loaded. Not a calendar. */
function TodayStrip({
  summary,
  total,
}: {
  summary: ReturnType<typeof summariseToday>;
  total: number;
}) {
  const items = [
    { label: 'On the roster', value: String(total) },
    { label: 'Training today', value: String(summary.trainingToday) },
    { label: 'Check-ins to read', value: String(summary.checkInsToRead) },
    { label: 'Races within six weeks', value: String(summary.racesWithin.length) },
    { label: 'Programmes ending', value: String(summary.programmesEnding) },
  ];

  return (
    <Panel className="p-5 sm:p-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="im-micro">{item.label}</dt>
            <dd className="mt-1.5 im-display text-[1.4rem] leading-none">{item.value}</dd>
          </div>
        ))}
      </dl>

      {summary.racesWithin.length > 0 && (
        <p className="mt-5 border-t border-hairline pt-4 text-[12.5px] leading-relaxed text-ink-secondary">
          Next race:{' '}
          <Link href={`/coach/athletes/${summary.racesWithin[0].athleteId}`} className="text-mint hover:underline">
            {summary.racesWithin[0].athleteName}
          </Link>{' '}
          — {summary.racesWithin[0].raceName} in {summary.racesWithin[0].days} days.
        </p>
      )}
    </Panel>
  );
}

/**
 * One athlete: signal, context, action.
 *
 * Enough to decide whether opening them is worth it, and never so much that
 * the roster becomes the athlete page.
 */
function AthleteRow({ entry, today, selected, onToggle }: {
  entry: RosterEntry;
  today: string;
  selected: boolean;
  onToggle: () => void;
}) {
  // A bare programme name does not tell a coach whether it is running. The
  // three states a programme can be in each read differently.
  const position = !entry.programmeName
    ? 'No programme'
    : entry.weekNo && entry.totalWeeks
      ? `${entry.blockName ?? 'Week'} — week ${entry.weekNo}/${entry.totalWeeks}`
      : entry.programmeEndDate && entry.programmeEndDate < today
        ? `${entry.programmeName} — finished`
        : `${entry.programmeName} — not started yet`;

  return (
    <Panel className={`min-w-0 p-5 transition-colors ${selected ? 'border-mint/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 gap-3.5">
          {/* a real checkbox: keyboard reachable, and it says whose it is */}
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${entry.fullName}`}
            className="mt-1 size-4.5 shrink-0 appearance-none rounded-[2px] border border-hairline-strong bg-slate transition-colors checked:border-mint checked:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
          />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {entry.topSignal && (
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[entry.topSignal.severity]}`}
              />
            )}
            <h3 className="im-display text-[1.05rem]">{entry.fullName}</h3>
            {entry.recentAdaptations > 0 && (
              <span className="im-mono text-[10px] uppercase tracking-[0.1em] text-ink-tertiary">
                you changed {entry.recentAdaptations} this week
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[12.5px] text-ink-secondary">
            {position}
            {entry.adherencePct != null && ` · ${entry.adherencePct}% of the last four weeks`}
          </p>

          {/* the signals, each a sentence and a way to act on it */}
          {entry.signals.length > 0 && (
            <ul className="mt-3 grid gap-1.5">
              {entry.signals.map((signal) => (
                <li key={signal.kind} className="flex min-w-0 items-baseline gap-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`}
                  />
                  <Link
                    href={signal.href}
                    className="min-w-0 break-words text-[13px] leading-relaxed text-ink-body hover:text-mint focus-visible:text-mint"
                  >
                    {signal.detail}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* context: what they did last, what is next */}
          <p className="mt-3 im-mono text-[11px] leading-relaxed text-ink-tertiary">
            {entry.lastCompletedName
              ? `Last: ${entry.lastCompletedName}${
                  entry.daysSinceTraining === 0 ? ' today'
                    : entry.daysSinceTraining === 1 ? ' yesterday'
                    : ` ${entry.daysSinceTraining} days ago`}`
              : 'Nothing logged yet'}
            {entry.nextSessionName && entry.nextSessionDate &&
              ` · Next: ${entry.nextSessionName}, ${formatDayMonth(entry.nextSessionDate)}`}
          </p>
        </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {entry.checkIn && !entry.checkIn.acknowledgedAt && (
            <Badge tone={entry.checkIn.attention === 'attention' ? 'neutral' : 'neutral'}>
              Check-in
            </Badge>
          )}
          <Link
            href={`/coach/athletes/${entry.athleteId}`}
            className="inline-flex items-center rounded-xs border border-hairline-strong px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-body transition-colors hover:border-mint hover:text-mint"
          >
            Open
          </Link>
        </div>
      </div>

      {/* what the athlete actually said, not a number derived from it */}
      {entry.checkIn && !entry.checkIn.acknowledgedAt && (
        <CheckInDetail checkIn={entry.checkIn} athleteId={entry.athleteId} />
      )}
    </Panel>
  );
}

function CheckInDetail({
  checkIn,
  athleteId,
}: {
  checkIn: NonNullable<RosterEntry['checkIn']>;
  athleteId: string;
}) {
  const scores = [
    checkIn.fatigue != null && `fatigue ${checkIn.fatigue}`,
    checkIn.soreness != null && `soreness ${checkIn.soreness}`,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="im-micro">Check-in · week of {formatDayMonth(checkIn.weekStart)}</p>
        <Link href={`/coach/athletes/${athleteId}#checkins`} className="text-[11px] text-mint hover:underline">
          Read and reply
        </Link>
      </div>
      {scores.length > 0 && (
        <p className="mt-2 im-mono text-[11px] text-ink-secondary">{scores.join(' · ')}</p>
      )}
      {checkIn.painOrNiggles && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-body">{checkIn.painOrNiggles}</p>
      )}
    </div>
  );
}
