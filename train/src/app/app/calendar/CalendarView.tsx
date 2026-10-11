'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { rescheduleSession } from '@/app/actions/training';
import { SectionHeading } from '@/components/forge/AppHeader';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { SessionCard } from '@/components/forge/SessionCard';
import { SessionGlyph } from '@/components/forge/SessionGlyph';
import { StatusTag, sessionLabel, sessionTone } from '@/components/ui/StatusTag';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import {
  addDays,
  formatDayMonth,
  formatDistance,
  formatLongDate,
  isSameMonth,
  monthGrid,
  monthLabel,
  startOfMonth,
  startOfWeek,
  WEEKDAY_LABELS,
  weekDates,
} from '@/lib/domain/dates';
import type { ScheduledWorkout, Units } from '@/lib/domain/types';

type View = 'day' | 'week' | 'month';

/**
 * THE TRAINING CALENDAR — a programme, not a pile of workouts.
 *
 * Two decisions carry this screen:
 *
 * Type is a glyph, status is a treatment. Colour-coding eight session types
 * produces confetti; a stride mark, a plateau, a bar and a flag read instantly
 * and leave colour free for the one thing that needs attention.
 *
 * Every week states its volume. A programme is a progression, so each week row
 * carries its prescribed and completed kilometres and the month view carries a
 * volume trace — which is what turns a grid of boxes into a training block you
 * can see the shape of.
 */
export function CalendarView({
  initialWorkouts,
  units,
  today,
}: {
  initialWorkouts: ScheduledWorkout[];
  units: Units;
  today: string;
}) {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(today);
  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [, start] = useTransition();

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>();
    for (const w of workouts) {
      const list = map.get(w.date) ?? [];
      list.push(w);
      map.set(w.date, list);
    }
    return map;
  }, [workouts]);

  const dates =
    view === 'day' ? [anchor] : view === 'week' ? weekDates(startOfWeek(anchor)) : monthGrid(anchor);

  /** Prescribed and completed running volume for a Monday-anchored week. */
  const weekVolume = (weekStart: string) => {
    const days = weekDates(weekStart);
    let planned = 0;
    let done = 0;
    for (const d of days) {
      for (const w of byDate.get(d) ?? []) {
        if (w.distanceKm == null) continue;
        planned += w.distanceKm;
        if (w.status === 'completed') done += w.distanceKm;
      }
    }
    return { planned: Math.round(planned * 10) / 10, done: Math.round(done * 10) / 10 };
  };

  // month view: one volume figure per week, so the block's shape is visible
  const monthWeeks = useMemo(() => {
    if (view !== 'month') return [];
    const first = startOfWeek(startOfMonth(anchor));
    return Array.from({ length: 6 }, (_, i) => {
      const ws = addDays(first, i * 7);
      return { weekStart: ws, ...weekVolume(ws) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, byDate]);

  function shift(direction: 1 | -1) {
    setAnchor((a) =>
      view === 'day'
        ? addDays(a, direction)
        : view === 'week'
          ? addDays(a, 7 * direction)
          : startOfMonth(addDays(startOfMonth(a), direction * 32)),
    );
  }

  function onDrop(date: string) {
    const id = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!id) return;

    const workout = workouts.find((w) => w.id === id);
    if (!workout || workout.date === date) return;
    if (workout.status === 'completed') {
      setError('Completed sessions stay on the day they happened.');
      return;
    }

    const previous = workouts;
    setWorkouts((ws) => ws.map((w) => (w.id === id ? { ...w, date, status: 'rescheduled' } : w)));
    setError(null);

    start(async () => {
      const result = await rescheduleSession(id, date);
      if (!result.ok) {
        setWorkouts(previous);
        setError(result.message);
      }
    });
  }

  const label =
    view === 'day'
      ? formatLongDate(anchor)
      : view === 'month'
        ? monthLabel(anchor)
        : `${formatDayMonth(startOfWeek(anchor))} – ${formatDayMonth(addDays(startOfWeek(anchor), 6))}`;

  const selectedWorkout = selected ? workouts.find((w) => w.id === selected) : null;
  const thisWeek = weekVolume(startOfWeek(anchor));

  return (
    <div>
      {/* ---- controls ---- */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <NavButton label="Previous period" onClick={() => shift(-1)}>
            ‹
          </NavButton>
          <p className="im-display min-w-0 flex-1 truncate text-center text-[0.9rem] text-ink sm:min-w-[190px] sm:flex-none sm:text-[1rem]">
            {label}
          </p>
          <NavButton label="Next period" onClick={() => shift(1)}>
            ›
          </NavButton>
          <Button variant="quiet" size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-5">
          {view !== 'month' && (
            <p className="im-mono hidden text-[11px] tracking-[0.12em] text-ink-secondary sm:block">
              <span className="font-bold text-ink">{formatDistance(thisWeek.done, units)}</span> of{' '}
              {formatDistance(thisWeek.planned, units)} this week
            </p>
          )}
          <div role="tablist" aria-label="Calendar view" className="flex gap-1">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-xs border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  view === v
                    ? 'border-mint bg-mint/10 text-ink'
                    : 'border-hairline-strong text-ink-secondary hover:text-ink'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-[13px] font-bold text-status-missed">
          {error}
        </p>
      )}

      {/* ---- day ---- */}
      {view === 'day' && (
        <div className="mt-7 space-y-5">
          {(byDate.get(anchor) ?? []).map((w) => (
            <SessionCard key={w.id} workout={w} units={units} />
          ))}
          {!byDate.get(anchor)?.length && (
            <Panel className="p-7">
              <p className="text-[14px] text-ink-secondary">Nothing scheduled on this day.</p>
            </Panel>
          )}
        </div>
      )}

      {/* ---- week ---- */}
      {view === 'week' && (
        <div className="im-scroll mt-7 overflow-x-auto">
          <div className="grid min-w-[880px] grid-cols-7 gap-px bg-hairline">
            {dates.map((date, i) => {
              const sessions = byDate.get(date) ?? [];
              const isToday = date === today;
              return (
                <div
                  key={date}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(date);
                  }}
                  onDragLeave={() => setDropTarget((d) => (d === date ? null : d))}
                  onDrop={() => onDrop(date)}
                  className={`min-h-[300px] p-3.5 transition-colors ${
                    dropTarget === date ? 'bg-mint/8' : isToday ? 'bg-slate' : 'bg-charcoal'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`im-micro ${isToday ? 'text-mint' : ''}`}>
                      {WEEKDAY_LABELS[i]}
                    </span>
                    <span
                      className={`im-mono text-[11px] font-bold ${
                        isToday ? 'text-mint' : 'text-ink-tertiary'
                      }`}
                    >
                      {date.slice(8)}
                    </span>
                  </div>

                  <ul className="mt-3.5 space-y-2">
                    {sessions.map((w) => (
                      <li key={w.id}>
                        <div
                          draggable={w.status !== 'completed'}
                          onDragStart={() => setDragging(w.id)}
                          onDragEnd={() => setDragging(null)}
                          onClick={() => setSelected(w.id === selected ? null : w.id)}
                          className={`im-panel cursor-pointer p-3 transition-colors ${
                            dragging === w.id ? 'opacity-40' : ''
                          } ${selected === w.id ? 'border-mint/50' : ''}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <SessionGlyph type={w.type} status={w.status} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-[12px] font-semibold ${
                                  w.status === 'missed'
                                    ? 'text-ink-tertiary line-through'
                                    : 'text-ink-body'
                                }`}
                              >
                                {w.name}
                              </span>
                              <span className="im-mono mt-1 block text-[10px] text-ink-secondary">
                                {w.type === 'rest'
                                  ? 'Rest'
                                  : w.distanceKm != null
                                    ? formatDistance(w.distanceKm, units)
                                    : w.durationMinutes != null
                                      ? `${w.durationMinutes} min`
                                      : ''}
                              </span>
                            </span>
                          </div>
                          {w.coachNote && (
                            <p className="mt-2.5 border-l border-mint pl-2.5 text-[11px] leading-snug text-ink-secondary">
                              {w.coachNote}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {!sessions.length && (
                    <p className="mt-4 text-[11px] text-ink-faint">—</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
            Drag a session to another day to reschedule it. Completed sessions stay where they
            happened.
          </p>
        </div>
      )}

      {/* ---- month: the block, and its shape ---- */}
      {view === 'month' && (
        <div className="im-scroll mt-7 overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[repeat(7,1fr)_120px] gap-px">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="im-micro px-2 pb-2.5">
                  {d}
                </div>
              ))}
              <div className="im-micro px-2 pb-2.5 text-right">Week</div>
            </div>

            <div className="grid grid-cols-[repeat(7,1fr)_120px] gap-px bg-hairline">
              {dates.map((date, i) => {
                const sessions = byDate.get(date) ?? [];
                const outside = !isSameMonth(date, anchor);
                const isToday = date === today;
                const weekIndex = Math.floor(i / 7);

                return (
                  <Fragment key={date}>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropTarget(date);
                      }}
                      onDragLeave={() => setDropTarget((d) => (d === date ? null : d))}
                      onDrop={() => onDrop(date)}
                      className={`min-h-[92px] p-2 transition-colors ${
                        outside ? 'opacity-35' : ''
                      } ${dropTarget === date ? 'bg-mint/8' : isToday ? 'bg-slate' : 'bg-charcoal'}`}
                    >
                      <span
                        className={`im-mono text-[11px] ${
                          isToday ? 'font-bold text-mint' : 'text-ink-tertiary'
                        }`}
                      >
                        {date.slice(8)}
                      </span>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {sessions.map((w) => (
                          <li key={w.id}>
                            <button
                              type="button"
                              draggable={w.status !== 'completed'}
                              onDragStart={() => setDragging(w.id)}
                              onDragEnd={() => setDragging(null)}
                              onClick={() => setSelected(w.id === selected ? null : w.id)}
                              title={`${w.name} — ${sessionLabel(w.status)}`}
                              aria-label={`${w.name}, ${sessionLabel(w.status)}`}
                              className="rounded-[2px] p-0.5 transition-colors hover:bg-white/6"
                            >
                              <SessionGlyph type={w.type} status={w.status} size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* the week's volume, at the end of its row */}
                    {i % 7 === 6 && (
                      <div className="bg-charcoal px-3 py-2">
                        {monthWeeks[weekIndex] && monthWeeks[weekIndex].planned > 0 ? (
                          <>
                            <p className="im-mono text-right text-[12px] font-bold text-ink">
                              {formatDistance(monthWeeks[weekIndex].done, units)}
                            </p>
                            <p className="im-mono mt-0.5 text-right text-[10px] text-ink-secondary">
                              of {formatDistance(monthWeeks[weekIndex].planned, units)}
                            </p>
                            <div className="mt-2 h-px w-full bg-steel">
                              <div
                                className="h-px bg-mint"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (monthWeeks[weekIndex].done /
                                      Math.max(monthWeeks[weekIndex].planned, 0.001)) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="im-mono text-right text-[11px] text-ink-faint">—</p>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>

            {/* the block's shape, stated once */}
            {monthWeeks.some((w) => w.planned > 0) && (
              <div className="mt-6 border-t border-hairline pt-5">
                <SectionHeading
                  label="Volume across the block"
                  action={
                    <span className="im-mono text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
                      Completed, week by week
                    </span>
                  }
                />
                <ForgeLine
                  variant="performance"
                  data={monthWeeks.map((w) => w.done)}
                  reference={monthWeeks.map((w) => w.planned)}
                  label="Weekly volume completed against prescribed"
                  unit={units === 'metric' ? 'km' : 'mi'}
                  className="mt-4 w-full"
                  height={62}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- the selected session ---- */}
      {selectedWorkout && (
        <div className="mt-7">
          <SectionHeading
            label="Selected session"
            action={
              <Button variant="quiet" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            }
          />
          <div className="mt-4">
            <SessionCard workout={selectedWorkout} units={units} />
          </div>
        </div>
      )}

      {/* ---- what the marks mean ---- */}
      <div className="mt-9 border-t border-hairline pt-6">
        <SectionHeading label="Reading the calendar" />
        <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
          {(
            [
              ['easy_run', 'Run'],
              ['long_run', 'Long run'],
              ['threshold', 'Threshold'],
              ['intervals', 'Intervals'],
              ['hills', 'Hills'],
              ['strength', 'Strength'],
              ['recovery_run', 'Recovery'],
              ['rest', 'Rest'],
              ['race', 'Race'],
            ] as const
          ).map(([type, label]) => (
            <li key={type} className="flex items-center gap-2">
              <SessionGlyph type={type} size={15} />
              <span className="text-[11px] text-ink-secondary">{label}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
          {(
            [
              ['completed', 'Completed'],
              ['scheduled', 'Scheduled'],
              ['missed', 'Missed'],
            ] as const
          ).map(([status, label]) => (
            <li key={status} className="flex items-center gap-2">
              <SessionGlyph type="easy_run" status={status} size={15} />
              <span className="text-[11px] text-ink-secondary">{label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <StatusTag tone={sessionTone('rescheduled')}>Moved</StatusTag>
          </li>
        </ul>
      </div>

      <p className="mt-7 border-t border-hairline pt-5 text-[12px] leading-relaxed text-ink-tertiary">
        Your coach writes the programme. You can move a session within your week and log what
        actually happened — the prescription itself stays with your coach.{' '}
        <Link href="/app/coach" className="text-ink-secondary underline underline-offset-4 hover:text-mint">
          Ask for a change
        </Link>
      </p>
    </div>
  );
}

function NavButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center border border-hairline-strong text-[16px] text-ink-secondary transition-colors hover:border-mint hover:text-mint"
    >
      {children}
    </button>
  );
}
