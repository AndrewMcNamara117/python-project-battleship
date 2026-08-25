'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { rescheduleSession } from '@/app/actions/training';
import { WorkoutCard, WorkoutRow, statusLabel, statusTone } from '@/components/app/WorkoutCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import {
  addDays,
  formatDayMonth,
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
 * Training calendar.
 *
 * Sessions can be dragged to another day. An athlete may only move a session
 * that has not happened yet — a completed session stays on the day it actually
 * happened, and the coach owns the shape of the week either way. The server
 * action re-checks both rules; this component just makes the affordance honest.
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
  const [, start] = useTransition();
  const reduced = useReducedMotion();

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

    // optimistic — the server action reverts nothing on success, and on failure
    // the message below tells the athlete what actually happened
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

  return (
    <div>
      {/* ---- controls ---- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <NavButton label="Previous" onClick={() => shift(-1)}>
            ‹
          </NavButton>
          <p className="im-display min-w-[190px] text-center text-[1.05rem]">{label}</p>
          <NavButton label="Next" onClick={() => shift(1)}>
            ›
          </NavButton>
          <Button variant="quiet" size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
        </div>

        <div role="tablist" aria-label="Calendar view" className="flex gap-1">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-xs border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                view === v ? 'border-green bg-green/10 text-white' : 'border-line-2 text-muted hover:text-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-[13px] font-bold text-alert">
          {error}
        </p>
      )}

      {/* ---- day view ---- */}
      {view === 'day' && (
        <div className="mt-7 space-y-5">
          {(byDate.get(anchor) ?? []).map((w) => (
            <WorkoutCard key={w.id} workout={w} units={units} />
          ))}
          {!byDate.get(anchor)?.length && (
            <Panel className="p-8">
              <p className="text-[14px] text-muted">Nothing scheduled on this day.</p>
            </Panel>
          )}
        </div>
      )}

      {/* ---- week view ---- */}
      {view === 'week' && (
        <div className="im-scroll mt-7 overflow-x-auto">
          <div className="grid min-w-[860px] grid-cols-7 gap-px bg-line">
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
                  className={`min-h-[280px] bg-surface p-3 transition-colors ${
                    dropTarget === date ? 'bg-green/8' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`im-micro ${isToday ? 'text-green' : ''}`}>{WEEKDAY_LABELS[i]}</span>
                    <span className={`im-mono text-[11px] ${isToday ? 'text-green' : 'text-muted-2'}`}>
                      {date.slice(8)}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {sessions.map((w) => (
                      <li key={w.id}>
                        <motion.div
                          layout={!reduced}
                          draggable={w.status !== 'completed'}
                          onDragStart={() => setDragging(w.id)}
                          onDragEnd={() => setDragging(null)}
                          className={`im-panel p-3 ${
                            w.status !== 'completed' ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${dragging === w.id ? 'opacity-40' : ''}`}
                        >
                          <WorkoutRow workout={w} units={units} />
                          <div className="mt-2.5">
                            <Badge tone={statusTone(w.status)}>{statusLabel(w.status)}</Badge>
                          </div>
                          {w.coachNote && (
                            <p className="mt-2.5 border-l border-green pl-2.5 text-[11px] leading-snug text-muted">
                              {w.coachNote}
                            </p>
                          )}
                        </motion.div>
                      </li>
                    ))}
                  </ul>

                  {!sessions.length && <p className="mt-4 text-[11px] text-muted-2">—</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] text-muted-2">
            Drag a session to another day to reschedule it. Completed sessions stay where they
            happened.
          </p>
        </div>
      )}

      {/* ---- month view ---- */}
      {view === 'month' && (
        <div className="im-scroll mt-7 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 gap-px">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="im-micro px-2 pb-2.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-line">
              {dates.map((date) => {
                const sessions = byDate.get(date) ?? [];
                const outside = !isSameMonth(date, anchor);
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
                    className={`min-h-[104px] bg-surface p-2 transition-colors ${
                      outside ? 'opacity-40' : ''
                    } ${dropTarget === date ? 'bg-green/8' : ''}`}
                  >
                    <span className={`im-mono text-[11px] ${isToday ? 'font-bold text-green' : 'text-muted-2'}`}>
                      {date.slice(8)}
                    </span>
                    <ul className="mt-2 space-y-1">
                      {sessions.map((w) => (
                        <li key={w.id}>
                          <div
                            draggable={w.status !== 'completed'}
                            onDragStart={() => setDragging(w.id)}
                            onDragEnd={() => setDragging(null)}
                            className={`flex items-center gap-1.5 truncate text-[10px] ${
                              w.status === 'completed'
                                ? 'text-green'
                                : w.status === 'missed'
                                  ? 'text-alert/80 line-through'
                                  : 'text-muted'
                            }`}
                            title={w.name}
                          >
                            <span
                              aria-hidden
                              className={`block size-1.5 shrink-0 rounded-full ${
                                w.status === 'completed'
                                  ? 'bg-green'
                                  : w.type === 'rest'
                                    ? 'bg-muted-2'
                                    : 'bg-line-2'
                              }`}
                            />
                            <span className="truncate">{w.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-muted-2">
        Your coach writes the programme. You can move a session within your week and log what
        actually happened — the prescription itself stays with your coach.{' '}
        <Link href="/app/coach" className="text-muted underline underline-offset-4 hover:text-green">
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
      className="flex size-9 items-center justify-center border border-line-2 text-[16px] text-muted transition-colors hover:border-green hover:text-green"
    >
      {children}
    </button>
  );
}
