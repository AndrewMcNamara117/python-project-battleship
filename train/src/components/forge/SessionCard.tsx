import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/Panel';
import { StatusTag, sessionLabel, sessionTone } from '@/components/ui/StatusTag';
import { IntensityScale } from './IntensityScale';
import { formatDistance, formatMinutes, formatPaceRange } from '@/lib/domain/dates';
import { explainSession } from '@/lib/forge/assistant';
import { WORKOUT_TYPE_LABELS, type ScheduledWorkout, type Units } from '@/lib/domain/types';

/**
 * SESSION CARD — a prescribed session, presented so the athlete can execute it.
 *
 * The order is the argument: what it is, why it exists, the numbers to hold,
 * then how to run it. Most training apps show the numbers and omit the reason —
 * the purpose line is the part that makes this Iron Miles, because it is the
 * part a coach would actually say.
 *
 * Completed sessions swap the prescription for what happened. A session that is
 * done is a record, not an instruction.
 */
export function SessionCard({
  workout,
  units = 'metric',
  purpose = true,
  children,
  size = 'default',
  className,
}: {
  workout: ScheduledWorkout;
  units?: Units;
  /** The "why". Off in dense lists where it would repeat. */
  purpose?: boolean;
  children?: ReactNode;
  size?: 'default' | 'lead';
  className?: string;
}) {
  const isRest = workout.type === 'rest';
  const done = workout.status === 'completed';

  return (
    <Panel
      edge={!isRest && !done && workout.status === 'scheduled'}
      className={`flex flex-col ${size === 'lead' ? 'p-6 sm:p-8' : 'p-5 sm:p-6'} ${className ?? ''}`}
    >
      {/* what it is */}
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <p className="im-micro">{WORKOUT_TYPE_LABELS[workout.type]}</p>
          <h2
            className={`im-display im-display-tight mt-3 text-ink ${
              size === 'lead' ? 'text-[clamp(1.5rem,3.4vw,2.15rem)]' : 'text-[1.25rem]'
            }`}
          >
            {workout.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!isRest && <IntensityScale intensity={workout.intensity} showLabel={size === 'lead'} />}
          <StatusTag tone={sessionTone(workout.status)}>{sessionLabel(workout.status)}</StatusTag>
        </div>
      </div>

      {/* why it exists — the line most training apps leave out */}
      {purpose && !isRest && (
        <p className="mt-5 border-l-2 border-steel pl-4 text-[14px] leading-relaxed text-ink-body">
          {explainSession(workout)}
        </p>
      )}

      {/* the numbers to hold */}
      {!isRest && (
        <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-hairline pt-5 sm:grid-cols-4">
          {workout.distanceKm != null && (
            <Metric label="Distance" value={formatDistance(workout.distanceKm, units)} />
          )}
          {workout.durationMinutes != null && (
            <Metric label="Duration" value={formatMinutes(workout.durationMinutes)} />
          )}
          {workout.paceRange && <Metric label="Pace" value={formatPaceRange(workout.paceRange, units)} />}
          {workout.hrZone != null && <Metric label="Heart rate" value={`Zone ${workout.hrZone}`} />}
          {workout.rpeTarget != null && <Metric label="Effort" value={`RPE ${workout.rpeTarget}`} />}
        </dl>
      )}

      {/* how to run it */}
      {(workout.warmUp || workout.mainSet || workout.coolDown) && (
        <SessionStructure
          warmUp={workout.warmUp}
          mainSet={workout.mainSet}
          coolDown={workout.coolDown}
          className="mt-6 border-t border-hairline pt-5"
        />
      )}

      {workout.notes && (
        <p className="mt-5 border-t border-hairline pt-4 text-[13px] leading-relaxed text-ink-secondary">
          {workout.notes}
        </p>
      )}

      {workout.coachNote && (
        <div className="mt-5 border-l-2 border-mint bg-mint/5 px-5 py-4">
          <p className="im-micro text-mint">From your coach</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-body">{workout.coachNote}</p>
        </div>
      )}

      {children && <div className="mt-6 border-t border-hairline pt-5">{children}</div>}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-2 text-[15px] font-extrabold text-ink">{value}</dd>
    </div>
  );
}

/**
 * SESSION STRUCTURE — warm-up, main set, cool-down.
 *
 * The main set carries the weight; the bookends are deliberately quieter. An
 * athlete scanning this on a phone at the trailhead needs the main set to be
 * the thing their eye lands on.
 */
export function SessionStructure({
  warmUp,
  mainSet,
  coolDown,
  className,
}: {
  warmUp?: string | null;
  mainSet?: string | null;
  coolDown?: string | null;
  className?: string;
}) {
  const rows = [
    { label: 'Warm-up', body: warmUp, lead: false },
    { label: 'Main set', body: mainSet, lead: true },
    { label: 'Cool-down', body: coolDown, lead: false },
  ].filter((r) => r.body);

  if (!rows.length) return null;

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1.5 sm:flex-row sm:gap-5">
          <p className="im-micro shrink-0 sm:w-24 sm:pt-1">{r.label}</p>
          <p
            className={`text-[14px] leading-relaxed ${
              r.lead ? 'text-ink-body' : 'text-ink-secondary'
            }`}
          >
            {r.body}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * SESSION ROW — the compact form, for lists and calendars.
 * Same information hierarchy, one line.
 */
export function SessionRow({
  workout,
  units = 'metric',
  showDate,
}: {
  workout: ScheduledWorkout;
  units?: Units;
  showDate?: string;
}) {
  const done = workout.status === 'completed';
  const missed = workout.status === 'missed';

  return (
    <div className="flex items-center gap-3.5">
      <span
        aria-hidden
        className={`block h-9 w-0.5 shrink-0 rounded-[1px] ${
          done ? 'bg-status-completed' : missed ? 'bg-status-missed/60' : 'bg-steel'
        }`}
      />
      <span className="min-w-0 flex-1">
        {showDate && <span className="im-micro block text-[9px]">{showDate}</span>}
        <span
          className={`block truncate text-[13px] font-semibold ${
            missed ? 'text-ink-tertiary line-through' : 'text-ink-body'
          }`}
        >
          {workout.name}
        </span>
        <span className="im-mono mt-1 block text-[10px] tracking-[0.1em] text-ink-secondary">
          {workout.type === 'rest'
            ? 'Rest'
            : [
                workout.distanceKm != null ? formatDistance(workout.distanceKm, units) : null,
                workout.durationMinutes != null ? formatMinutes(workout.durationMinutes) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </span>
      </span>
    </div>
  );
}
