'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import {
  applyFilter, concernsFor, FILTER_LABELS, filterCounts, kindsForFilter,
  rankEntries, rosterWorkload, summariseToday,
} from '@/lib/domain/roster';
import type {
  RosterEntry, RosterFilter, Severity, WorkloadKind, WorkloadRow,
} from '@/lib/domain/roster';
import { formatDayMonth } from '@/lib/domain/dates';
import {
  allSelected, availableActions, BATCH_ACTION_LABEL, deselectAll, EMPTY_SELECTION,
  isSelected, reconcile, selectAll, selectedEntries, toggle,
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
 *
 * The screen answers it in two passes. The band states the week's workload by
 * concern — how much of each thing there is to do — and the list below states
 * each athlete once, whole. An athlete carrying three problems is counted in
 * three of those totals and listed one time, so the totals stay true and the
 * roster never reads as three copies of the same person.
 */

const SEVERITY_DOT: Record<Severity, string> = {
  urgent: 'bg-status-missed',
  attention: 'bg-amber',
  information: 'bg-hairline-strong',
};

/** The two ways to look at the whole squad. Concerns are chosen in the band. */
const SCOPES: RosterFilter[] = ['attention', 'all'];

export function RosterView({ roster, today, initialFilter = 'attention' }: {
  roster: RosterEntry[];
  today: string;
  initialFilter?: RosterFilter;
}) {
  const [filter, setFilter] = useState<RosterFilter>(initialFilter);
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

  // The band is computed from the whole roster, never from what is on screen,
  // so choosing a concern cannot change the numbers the coach is reading. Each
  // row's count is the count on the list it opens, because both are applyFilter.
  const workload = useMemo(() => rosterWorkload(roster), [roster]);

  // Ranked here rather than in the band: every athlete who needs the coach is
  // in this list exactly once, whatever they are counted in above.
  const listed = useMemo(() => rankEntries(visible), [visible]);
  const summary = useMemo(() => summariseToday(roster, today), [roster, today]);

  const visibleIds = visible.map((e) => e.athleteId);
  const everyVisibleChosen = allSelected(selection, visibleIds);

  return (
    <>
      <TodayStrip summary={summary} total={roster.length} />

      <WorkloadBand
        rows={workload}
        active={filter}
        needing={counts.attention}
        total={roster.length}
        onShow={(kind) => { setFilter(filter === kind ? 'attention' : kind); setSearch(''); }}
        onSelect={(row) => setSelection(selectAll(selection, row.athleteIds))}
        memberOf={(row) => roster.filter((e) => row.athleteIds.includes(e.athleteId))}
      />

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {SCOPES.map((key) => {
          const active = filter === key;
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
              <span className="ml-2 im-mono text-[10px] opacity-70">{counts[key]}</span>
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
          <ul className="mt-6 grid gap-3" aria-label="Athletes">
            {listed.map((entry) => (
              <li key={entry.athleteId}>
                <AthleteRow
                  entry={entry}
                  today={today}
                  active={filter}
                  selected={isSelected(selection, entry.athleteId)}
                  onToggle={() => setSelection(toggle(selection, entry.athleteId))}
                />
              </li>
            ))}
          </ul>
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

/**
 * THE WORKLOAD BAND
 *
 * What there is to do, by the thing that needs doing.
 *
 * Every count here is the count of everyone carrying that concern, including
 * the athletes who also appear in the row above and the row below. Nobody is
 * subtracted from one total to keep them out of another, because a coach
 * planning their morning needs to know there are seventeen people missing
 * training — not seventeen minus however many of them also have a check-in.
 *
 * The band deliberately holds no names. Names belong to the list underneath,
 * where each athlete appears once with everything that is true of them; if the
 * band listed them too, an athlete with three concerns would be written across
 * the screen three times, which is the failure this replaces, in reverse.
 * "Also need you elsewhere" says how much overlap there is without spending
 * the space to spell it out.
 */
function WorkloadBand({ rows, active, needing, total, onShow, onSelect, memberOf }: {
  rows: WorkloadRow[];
  active: RosterFilter;
  needing: number;
  total: number;
  onShow: (kind: WorkloadKind) => void;
  onSelect: (row: WorkloadRow) => void;
  memberOf: (row: WorkloadRow) => RosterEntry[];
}) {
  if (rows.length === 0) return null;

  return (
    <Panel className="mt-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="im-micro">What the week needs</h2>
        <p className="im-mono text-[11px] text-ink-tertiary">
          {needing} of {total} need you
        </p>
      </div>

      <ul className="mt-4 grid gap-1">
        {rows.map((row) => {
          const on = active === row.kind;
          // the actions Slice 9 already says are possible for these athletes —
          // the band offers no action of its own
          const actions = availableActions(memberOf(row));
          return (
            <li
              key={row.kind}
              className={`-mx-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xs px-2 py-2 transition-colors ${
                on ? 'bg-mint/[0.07]' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onShow(row.kind)}
                aria-pressed={on}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[row.severity]}`} />
                <span className={`min-w-0 break-words text-[13.5px] leading-relaxed ${
                  on ? 'text-mint' : 'text-ink-body'
                }`}>
                  {row.detail}
                </span>
                {row.alsoElsewhere > 0 && (
                  <span className="im-mono shrink-0 text-[10.5px] text-ink-tertiary">
                    {row.alsoElsewhere} also elsewhere
                  </span>
                )}
              </button>

              <div className="flex shrink-0 items-center gap-3">
                <span className="im-mono text-[11px] text-ink-tertiary" aria-hidden>
                  {on ? 'showing' : 'show'}
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  title={actions.length
                    ? `Then: ${actions.map((a) => BATCH_ACTION_LABEL[a]).join(', ')}`
                    : undefined}
                  className="rounded-xs border border-hairline-strong px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-ink-body transition-colors hover:border-mint hover:text-mint"
                >
                  Select {row.count}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
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
function AthleteRow({ entry, today, active, selected, onToggle }: {
  entry: RosterEntry;
  today: string;
  /** Which concern the coach is looking through, so the row can say why. */
  active: RosterFilter;
  selected: boolean;
  onToggle: () => void;
}) {
  // Every signal is shown whichever concern is being viewed. Filtering to
  // "missing training" must never hide the fact that this athlete also said
  // their Achilles hurts — that is the whole point of the list underneath.
  const concerns = concernsFor(entry);
  const matched = new Set<string>(kindsForFilter(active));
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
            {/* which of the week's concerns this athlete is part of, named
                rather than counted: "3 concerns" above six sentences told a
                coach nothing, and an athlete whose second signal was only
                informational got no marker at all */}
            {concerns.length > 1 && (
              <span className="im-mono text-[10px] uppercase tracking-[0.1em] text-amber">
                {concerns.map((k) => FILTER_LABELS[k]).join(' · ')}
              </span>
            )}
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
                <li
                  key={signal.kind}
                  className={`flex min-w-0 items-baseline gap-2.5 ${
                    matched.has(signal.kind) ? 'border-l-2 border-mint/50 -ml-2.5 pl-2' : ''
                  }`}
                >
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
