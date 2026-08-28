'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import {
  applyFilter, concernsFor, FILTER_LABELS, filterCounts, kindsForFilter,
  rankEntries, rosterWorkload, summariseToday, waitedFor,
} from '@/lib/domain/roster';
import type {
  RosterEntry, RosterFilter, Severity, Signal, WorkloadKind, WorkloadRow,
} from '@/lib/domain/roster';
import { formatDayMonth } from '@/lib/domain/dates';
import {
  allSelected, availableActions, BATCH_ACTION_LABEL, deselectAll, EMPTY_SELECTION,
  isSelected, reconcile, selectAll, selectedEntries, toggle,
} from '@/lib/domain/batch';
import type { Selection } from '@/lib/domain/batch';
import { BatchBar } from './BatchBar';
import { ReplyToAthlete } from './ReplyToAthlete';

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

export function RosterView({ roster, today, now, initialFilter = 'attention' }: {
  roster: RosterEntry[];
  today: string;
  /** Stamped on the server so a waiting time does not drift as the tab sits open. */
  now: string;
  initialFilter?: RosterFilter;
}) {
  const [filter, setFilter] = useState<RosterFilter>(initialFilter);
  const [search, setSearch] = useState('');

  // Selection is deliberate and it is the coach's. It is never derived from a
  // filter at apply time — a selection stored as "everyone matching this"
  // changes underneath them between the review and the confirmation. It does
  // survive filtering, so four athletes chosen, then a filter, then back, are
  // still the same four.
  // Which athletes the coach has opened up. Kept by id, so filtering or
  // acting on somebody does not close everything the coach was reading.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpanded = (id: string) => setExpanded((open) => {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    return next;
  });

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
                  now={now}
                  active={filter}
                  selected={isSelected(selection, entry.athleteId)}
                  onToggle={() => setSelection(toggle(selection, entry.athleteId))}
                  open={expanded.has(entry.athleteId)}
                  onOpen={() => toggleExpanded(entry.athleteId)}
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
function AthleteRow({ entry, today, now, active, selected, onToggle, open, onOpen }: {
  entry: RosterEntry;
  today: string;
  /** For waiting times, which are a clock rather than a calendar. */
  now: string;
  /** Which concern the coach is looking through, so the row can say why. */
  active: RosterFilter;
  selected: boolean;
  onToggle: () => void;
  /** Whether the coach has opened this athlete up. */
  open: boolean;
  onOpen: () => void;
}) {
  // Every signal is shown whichever concern is being viewed. Filtering to
  // "missing training" must never hide the fact that this athlete also said
  // their Achilles hurts — that is the whole point of the list underneath.
  const matched = new Set<string>(kindsForFilter(active));

  /**
   * PROGRESSIVE DISCLOSURE.
   *
   * The collapsed row leads. It carries whatever the coach needs to triage —
   * who, the two loudest reasons, and where to act — and says how much else
   * is true rather than printing it. Opening the athlete adds the rest.
   *
   * Nothing is removed by collapsing: every signal, every supporting fact and
   * the check-in itself are one keystroke away on the same row, and the
   * counts above are computed from the whole roster regardless of what is
   * open. This is about how much a coach has to read, not what is true.
   */
  const LEAD = 2;
  const lead = entry.signals.slice(0, LEAD);
  // The chips name the concerns this athlete belongs to. Naming one the
  // leading lines already state is the same repetition this slice exists to
  // remove — on a phone those chips wrapped to six lines saying what was
  // written directly underneath. So they name what is NOT yet visible.
  const covered = new Set(lead.flatMap((sig) =>
    concernsFor(entry).filter((k) => kindsForFilter(k).includes(sig.kind))));
  const alsoIn = concernsFor(entry).filter((k) => !covered.has(k));
  const rest = entry.signals.slice(LEAD);
  const extraFacts = entry.signals.reduce((n, sig) => n + (sig.supporting?.length ?? 0), 0);
  const hasCheckIn = Boolean(entry.checkIn && !entry.checkIn.acknowledgedAt);
  const more = rest.length + extraFacts + (hasCheckIn ? 1 : 0)
    + (entry.conversation ? 1 : 0);
  const panelId = `athlete-${entry.athleteId}-detail`;
  const [replying, setReplying] = useState(false);
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
        {/* basis-64 so the actions wrap BELOW on a phone rather than squeezing
            this column to nothing: with min-w-0 and no basis, a long sentence
            wrapped to one character per line and a card ran to 1053px. */}
        <div className="flex min-w-0 flex-1 basis-64 gap-3.5">
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
            {alsoIn.length > 0 && (
              <span className="im-mono text-[10px] uppercase tracking-[0.1em] text-amber">
                also {alsoIn.map((k) => FILTER_LABELS[k]).join(' · ')}
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
          {lead.length > 0 && (
            <ul className="mt-3 grid gap-1.5">
              {lead.map((signal) => (
                <SignalLine key={signal.kind} signal={signal} matched={matched} open={open} />
              ))}
            </ul>
          )}

          {/* the rest, on the same row, one keystroke away */}
          {more > 0 && (
            <>
              <button
                type="button"
                onClick={onOpen}
                aria-expanded={open}
                aria-controls={panelId}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xs text-[12px] text-ink-tertiary transition-colors hover:text-mint focus-visible:text-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
              >
                <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                {/* The name is for screen readers, which read this button out
                    of the context of the card it sits on. On screen the name
                    is two lines above and does not need repeating. */}
                <span>{open ? 'Show less' : `${more} more`}</span>
                <span className="sr-only"> about {entry.fullName}</span>
              </button>

              <div id={panelId} hidden={!open}>
                {rest.length > 0 && (
                  <ul className="mt-2 grid gap-1.5">
                    {rest.map((signal) => (
                      <SignalLine key={signal.kind} signal={signal} matched={matched} open />
                    ))}
                  </ul>
                )}
              </div>
            </>
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
          {entry.conversation && (
            <button
              type="button"
              onClick={() => { setReplying(true); if (!open) onOpen(); }}
              className="rounded-xs border border-mint/40 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-mint transition-colors hover:border-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            >
              Reply
              <span className="ml-1.5 opacity-60">
                {waitedFor(entry.conversation.waitingSince, now)}
              </span>
            </button>
          )}
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

      {/* What the athlete actually said. Detail, so it waits to be asked for
          — unlike the reply box below, which is an action and stays put. */}
      {hasCheckIn && open && (
        <CheckInDetail checkIn={entry.checkIn!} athleteId={entry.athleteId} />
      )}

      {/* The answer is written here, with their words above it. It opens with
          the rest of the row rather than standing open on all fourteen waiting
          athletes at once — on a phone that was 186px of reply box per card.
          It costs the coach nothing: Reply opens the row AND puts the cursor
          in the box, which is the same one click as clicking into a box that
          was already there. */}
      {entry.conversation && open && (
        <ReplyToAthlete
          athleteId={entry.athleteId}
          athleteName={entry.fullName}
          waited={waitedFor(entry.conversation.waitingSince, now)}
          latest={entry.conversation.latest}
          unanswered={entry.conversation.unanswered}
          focusOnMount={replying}
        />
      )}
    </Panel>
  );
}

/**
 * One signal, and the facts it is made of.
 *
 * The supporting lines are the sentences a canonical signal replaced —
 * "13 sessions missed", "Missed Threshold" — kept exact and shown when the
 * coach opens the athlete. The headline says the situation; these say what it
 * is made of.
 */
function SignalLine({ signal, matched, open }: {
  signal: Signal;
  matched: Set<string>;
  open: boolean;
}) {
  // No min-w-0 on the grid item itself: it lets the row shrink below its own
  // content, and a `break-words` link inside then wraps to one character per
  // line — 697px tall for a single sentence, on a phone.
  return (
    <li className={matched.has(signal.kind) ? 'border-l-2 border-mint/50 -ml-2.5 pl-2' : ''}>
      <div className="flex min-w-0 items-baseline gap-2.5">
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
      </div>

      {open && signal.supporting && signal.supporting.length > 0 && (
        <ul className="mt-1 ml-5 grid gap-0.5">
          {signal.supporting.map((line) => (
            <li key={line} className="text-[12.5px] leading-relaxed text-ink-tertiary">{line}</li>
          ))}
        </ul>
      )}
    </li>
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
