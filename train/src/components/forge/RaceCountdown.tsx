import { ForgeLine } from './ForgeLine';
import { TopoField } from './TopoField';
import { formatDistance, formatLongDate } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';

/**
 * RACE COUNTDOWN — the reason the athlete is training.
 *
 * The days figure is the largest number in the product, because it is the one
 * that reframes everything else on the screen. Terrain sits behind it, masked
 * away from the numerals so contours never run beneath the count.
 *
 * The ForgeLine here is the `race` variant: the line arrives at a start line.
 * Its shape is derived from the athlete's completed weekly volume, so it is
 * their own training, not an illustration.
 */
export function RaceCountdown({
  raceName,
  raceDate,
  distanceKm,
  daysToGo,
  units,
  eventLabel,
  trajectory,
}: {
  raceName: string;
  raceDate: string;
  distanceKm: number | null;
  daysToGo: number | null;
  units: Units;
  eventLabel: string;
  /** Completed weekly volume, oldest first. The line to the start. */
  trajectory: number[];
}) {
  return (
    <section
      className="im-panel im-panel-raised relative isolate overflow-hidden"
      aria-label="Your goal race"
    >
      <TopoField context="header" safe="radial" offset={12} />

      {/* On a phone this is context, not the answer — it stays compact so
          today's session is the first substantial thing in the viewport. */}
      <div className="relative z-1 flex items-start justify-between gap-4 p-5 sm:gap-6 sm:p-8">
        <div className="min-w-0">
          <p className="im-micro">Goal race</p>
          <h2 className="im-display im-display-tight mt-2.5 text-[clamp(1.25rem,4.4vw,2.5rem)] text-ink sm:mt-3">
            {raceName}
          </h2>
          <p className="im-mono mt-2.5 text-[11px] tracking-[0.12em] text-ink-secondary sm:mt-3 sm:text-[12px]">
            {distanceKm != null ? `${formatDistance(distanceKm, units)} · ` : `${eventLabel} · `}
            {formatLongDate(raceDate)}
          </p>
        </div>

        {daysToGo != null && (
          <div className="shrink-0 text-right">
            <p className="im-figure text-[clamp(1.9rem,7vw,4.4rem)] text-mint">{daysToGo}</p>
            <p className="im-micro mt-1 text-[9px] sm:mt-1.5 sm:text-[10px]">
              {daysToGo === 1 ? 'day to go' : 'days to go'}
            </p>
          </div>
        )}
      </div>

      {trajectory.length > 1 && (
        <div className="relative z-1 hidden border-t border-hairline px-5 pb-5 pt-4 sm:block sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="im-micro">The work so far</p>
            <p className="im-mono text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
              Weekly volume · last {trajectory.length} weeks
            </p>
          </div>
          <ForgeLine
            variant="elevation"
            data={trajectory}
            label="Weekly volume over the block"
            unit={units === 'metric' ? 'km' : 'mi'}
            className="mt-3 w-full"
            height={54}
          />
        </div>
      )}
    </section>
  );
}
