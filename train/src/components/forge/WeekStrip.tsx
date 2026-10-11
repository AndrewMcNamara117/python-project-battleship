import Link from 'next/link';
import { Panel } from '@/components/ui/Panel';
import { WEEKDAY_LABELS, weekDates } from '@/lib/domain/dates';
import type { ScheduledWorkout } from '@/lib/domain/types';

/**
 * WEEK STRIP — seven days, one glance.
 *
 * The athlete's week as a row of instrument marks: a completed day is filled,
 * a missed day is struck, a rest day is a dash, today carries the accent. Each
 * mark is a link into that day, and each carries a text label for screen
 * readers — the shape is a convenience, never the only account of the week.
 */
export function WeekStrip({
  week,
  weekStart,
  today,
  adherencePct,
  actualLabel,
  targetLabel,
}: {
  week: ScheduledWorkout[];
  weekStart: string;
  today: string;
  adherencePct: number;
  actualLabel: string;
  targetLabel: string;
}) {
  const days = weekDates(weekStart);

  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="im-micro">This week</p>
        <p className="im-mono text-[12px] font-bold text-mint">{adherencePct}%</p>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((date, i) => {
          const sessions = week.filter((w) => w.date === date);
          const done = sessions.some((s) => s.status === 'completed');
          const missed = !done && sessions.some((s) => s.status === 'missed');
          const rest = sessions.length > 0 && sessions.every((s) => s.type === 'rest');
          const isToday = date === today;

          const state = done
            ? 'completed'
            : missed
              ? 'missed'
              : rest
                ? 'rest day'
                : sessions.length
                  ? 'scheduled'
                  : 'nothing scheduled';

          return (
            <li key={date} className="text-center">
              <span className="im-micro block text-[9px]">{WEEKDAY_LABELS[i]}</span>
              <Link
                href="/app/calendar"
                aria-label={`${WEEKDAY_LABELS[i]} ${date}: ${state}${
                  sessions.length ? ` — ${sessions.map((s) => s.name).join(', ')}` : ''
                }`}
                className={`mt-2 flex h-10 items-center justify-center rounded-xs border text-[11px] font-bold transition-colors ${
                  done
                    ? 'border-status-completed/60 bg-status-completed/15 text-status-completed'
                    : missed
                      ? 'border-status-missed/45 text-status-missed'
                      : rest
                        ? 'border-hairline text-ink-tertiary'
                        : sessions.length
                          ? 'border-hairline-strong text-ink-secondary hover:border-mint/50'
                          : 'border-hairline text-ink-faint'
                } ${isToday ? 'ring-1 ring-mint/60' : ''}`}
              >
                <span aria-hidden>{done ? '✓' : missed ? '✕' : rest ? '—' : sessions.length ? '•' : ''}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-auto border-t border-hairline pt-4 text-[12px] text-ink-secondary" style={{ marginTop: 'auto' }}>
        <span className="im-mono font-bold text-ink-body">{actualLabel}</span> of {targetLabel} prescribed
      </p>
    </Panel>
  );
}
