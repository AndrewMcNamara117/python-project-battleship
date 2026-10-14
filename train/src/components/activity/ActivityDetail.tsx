import type { ReactNode } from 'react';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Rise } from '@/components/motion/Rise';
import { Panel } from '@/components/ui/Panel';
import { SPORT_LABELS, type Activity } from '@/lib/activity/types';
import { formatDuration, formatLongDate, formatPace } from '@/lib/domain/dates';
import type { ScheduledWorkout, Units } from '@/lib/domain/types';
import { distanceLabel, PlanVsActual, ProfileCharts, SplitsTable, StatStrip, ZonePanel } from './ActivityPanels';
import { RouteMap } from './RouteMap';

/** "Morning run, Saturday 10 October — 8.02 km in 42:51, 5:21 /km" — the route's accessible name. */
export function describeActivity(a: Activity, units: Units): string {
  return `${a.name}, ${formatLongDate(a.localDate)} — ${distanceLabel(a.distanceM, units)} in ${formatDuration(a.movingS)}, ${formatPace(a.avgPaceSecPerKm, units)}`;
}

/**
 * One activity, the same for athlete and coach. What differs is passed in:
 * the athlete gets the controls and the session picker; the coach gets the
 * plain record.
 */
export function ActivityDetail({
  activity,
  session,
  units,
  maxHr,
  viewer,
  controls,
  attach,
  social,
}: {
  activity: Activity;
  session: ScheduledWorkout | null;
  units: Units;
  maxHr: number | null;
  viewer: 'athlete' | 'coach';
  controls?: ReactNode;
  attach?: ReactNode;
  /** Sharing, kudos and comments. */
  social?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <Rise>
        <Panel edge className="p-0">
          <RouteMap route={activity.route} trimM={activity.privacyTrimM} label={`Route of ${describeActivity(activity, units)}`} />
        </Panel>
      </Rise>

      <Rise delay={40}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="text-[13px] text-ink-secondary">
            {SPORT_LABELS[activity.sport]} · {activity.format.toUpperCase()} file
            {activity.source !== 'upload' && ` · via ${activity.source}`}
          </p>
          {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        </div>
      </Rise>

      <Rise delay={60}>
        <StatStrip activity={activity} units={units} />
      </Rise>

      {!session && (attach || viewer === 'coach') && (
        <Rise delay={80}>
          <Panel className="p-5 sm:p-6">
            {viewer === 'athlete' ? (
              <>
                <SectionHeading label="Which session was this?" />
                <div className="mt-4">{attach}</div>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Not attached to a session — run outside the plan, or the athlete has not yet said which session it was.
              </p>
            )}
          </Panel>
        </Rise>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-5">
          {session && (
            <Rise delay={80}>
              <PlanVsActual activity={activity} session={session} units={units} maxHr={maxHr} />
            </Rise>
          )}
          <Rise delay={100}>
            <ZonePanel
              activity={activity}
              maxHr={maxHr}
              prescribedZone={session?.hrZone ?? null}
              settingsHref={viewer === 'athlete' ? '/app/activities#settings' : undefined}
            />
          </Rise>
          <Rise delay={120}>
            <ProfileCharts activity={activity} units={units} />
          </Rise>
        </div>
        <div className="min-w-0">
          <Rise delay={100}>
            <SplitsTable splits={activity.splits} units={units} />
          </Rise>
          {social && (
            <Rise delay={120}>
              <div className="mt-5">{social}</div>
            </Rise>
          )}
        </div>
      </div>
    </div>
  );
}
