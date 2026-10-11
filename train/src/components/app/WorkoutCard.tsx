import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { formatDistance, formatMinutes, formatPaceRange } from '@/lib/domain/dates';
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS, type ScheduledWorkout, type Units } from '@/lib/domain/types';

export function statusTone(status: ScheduledWorkout['status']): BadgeTone {
  switch (status) {
    case 'completed':
      return 'green';
    case 'missed':
      return 'alert';
    case 'rescheduled':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: ScheduledWorkout['status']): string {
  return { scheduled: 'Scheduled', completed: 'Done', missed: 'Missed', rescheduled: 'Moved', skipped: 'Skipped' }[
    status
  ];
}

export function intensityTone(intensity: ScheduledWorkout['intensity']): BadgeTone {
  return intensity === 'hard' || intensity === 'max' ? 'green' : 'neutral';
}

/** The prescription, laid out the way an athlete reads it: what, how hard, how much. */
export function WorkoutCard({
  workout,
  units = 'metric',
  children,
  compact = false,
}: {
  workout: ScheduledWorkout;
  units?: Units;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const isRest = workout.type === 'rest';

  return (
    <Panel edge={!isRest && workout.status === 'scheduled'} className={compact ? 'p-6' : 'p-7 sm:p-8'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="im-micro">{WORKOUT_TYPE_LABELS[workout.type]}</p>
          <h3 className={`im-display mt-3 ${compact ? 'text-[1.3rem]' : 'text-[clamp(1.5rem,3vw,2rem)]'}`}>
            {workout.name}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!isRest && <Badge tone={intensityTone(workout.intensity)}>{INTENSITY_LABELS[workout.intensity]}</Badge>}
          <Badge tone={statusTone(workout.status)}>{statusLabel(workout.status)}</Badge>
        </div>
      </div>

      {!isRest && (
        <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-hairline pt-6 sm:grid-cols-4">
          {workout.distanceKm != null && (
            <Metric label="Distance" value={formatDistance(workout.distanceKm, units)} />
          )}
          {workout.durationMinutes != null && (
            <Metric label="Duration" value={formatMinutes(workout.durationMinutes)} />
          )}
          {workout.paceRange && <Metric label="Pace" value={formatPaceRange(workout.paceRange, units)} />}
          {workout.hrZone != null && <Metric label="HR zone" value={`Zone ${workout.hrZone}`} />}
          {workout.rpeTarget != null && <Metric label="RPE target" value={String(workout.rpeTarget)} />}
        </dl>
      )}

      {(workout.warmUp || workout.mainSet || workout.coolDown) && (
        <div className="mt-7 space-y-4 border-t border-hairline pt-6">
          {workout.warmUp && <Block label="Warm-up" body={workout.warmUp} />}
          {workout.mainSet && <Block label="Main set" body={workout.mainSet} accent />}
          {workout.coolDown && <Block label="Cool-down" body={workout.coolDown} />}
        </div>
      )}

      {workout.notes && (
        <p className="mt-6 border-t border-hairline pt-5 text-[13px] leading-relaxed text-ink-secondary">{workout.notes}</p>
      )}

      {workout.coachNote && (
        <div className="mt-6 border-l-2 border-mint bg-mint/5 px-5 py-4">
          <p className="im-micro text-mint">Coach note</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-body">{workout.coachNote}</p>
        </div>
      )}

      {children && <div className="mt-7 border-t border-hairline pt-6">{children}</div>}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-2 text-[15px] font-extrabold">{value}</dd>
    </div>
  );
}

function Block({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-5">
      <p className="im-micro shrink-0 sm:w-24 sm:pt-1">{label}</p>
      <p className={`text-[14px] leading-relaxed ${accent ? 'text-ink-body' : 'text-ink-secondary'}`}>{body}</p>
    </div>
  );
}

/** Compact row for calendars and lists. */
export function WorkoutRow({ workout, units = 'metric' }: { workout: ScheduledWorkout; units?: Units }) {
  const done = workout.status === 'completed';
  const missed = workout.status === 'missed';

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={`block h-8 w-0.5 shrink-0 ${done ? 'bg-mint' : missed ? 'bg-status-missed/60' : 'bg-line-2'}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12px] font-bold ${missed ? 'text-ink-tertiary line-through' : ''}`}>
          {workout.name}
        </span>
        <span className="im-mono mt-0.5 block text-[10px] tracking-[0.1em] text-ink-tertiary">
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
