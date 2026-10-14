import Link from 'next/link';
import type { Activity } from '@/lib/activity/types';
import { formatDayMonth, formatDuration, formatPace } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';
import { distanceLabel } from './ActivityPanels';
import { RouteMap } from './RouteMap';

/** A list of activities: thumbnail, name, figures, and whether it met the plan. */
export function ActivityList({
  activities,
  units,
  hrefFor,
}: {
  activities: Activity[];
  units: Units;
  hrefFor: (a: Activity) => string;
}) {
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-xs border border-hairline">
      {activities.map((a) => (
        <li key={a.id}>
          <Link
            href={hrefFor(a)}
            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 bg-charcoal px-3 py-3 transition-colors hover:bg-slate focus-visible:bg-slate sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:px-4"
          >
            <RouteMap route={a.route} trimM={a.privacyTrimM} label="" compact height={52} className="h-[52px] w-full overflow-hidden rounded-xs" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-ink group-hover:text-mint">{a.name}</p>
              <p className="mt-1 text-[12px] tabular-nums text-ink-secondary">
                {formatDayMonth(a.localDate)} · {distanceLabel(a.distanceM, units)} · {formatDuration(a.movingS)} ·{' '}
                {formatPace(a.avgPaceSecPerKm, units)}
                {a.avgHr ? ` · ${a.avgHr} bpm` : ''}
              </p>
            </div>
            <span
              className={`im-micro col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end ${
                a.scheduledWorkoutId ? 'text-mint' : 'text-ink-tertiary'
              }`}
            >
              {a.scheduledWorkoutId ? 'On the plan' : 'Not attached'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
