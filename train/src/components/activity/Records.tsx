import Link from 'next/link';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
import { personalRecords, RECORD_DISTANCES, type PersonalRecord } from '@/lib/activity/records';
import type { Activity } from '@/lib/activity/types';
import { formatDayMonth, formatDuration, formatPace } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';

const pace = (r: { elapsedS: number }, metres: number) => Math.round((r.elapsedS / metres) * 1000);

/** The athlete's records, each linked to the run that set it. */
export function PersonalRecords({
  activities,
  units,
  hrefFor,
}: {
  activities: Activity[];
  units: Units;
  hrefFor: (activityId: string) => string;
}) {
  const records = personalRecords(activities);
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Personal records" />
      {records.length ? (
        <ul className="mt-4 divide-y divide-hairline">
          {records.map((r: PersonalRecord) => (
            <li key={r.distance.key}>
              <Link
                href={hrefFor(r.activityId)}
                className="flex items-baseline justify-between gap-4 py-2.5 text-[13px] hover:bg-slate/40"
              >
                <span className="shrink-0 font-bold text-ink-secondary">{r.distance.label}</span>
                {/* time and pace wrap as a unit under each other when narrow, never over each other */}
                <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 text-right tabular-nums">
                  <span className="font-bold text-ink">{formatDuration(r.elapsedS)}</span>
                  <span className="whitespace-nowrap text-ink-tertiary">{formatPace(pace(r, r.distance.metres), units)}</span>
                  <span className="whitespace-nowrap text-[12px] text-ink-tertiary">· {formatDayMonth(r.date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-secondary">None yet.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
        The fastest stretch of each distance inside any imported run — a quick 5K in the middle of a long run counts.
        Found from watch files only; runs imported before records existed, and typed logs, are not included.
      </p>
    </Panel>
  );
}

/** This run's best efforts, marking any that are the athlete's record. */
export function BestEffortsPanel({ activity, others, units }: { activity: Activity; others: Activity[]; units: Units }) {
  if (!activity.bestEfforts.length) return null;
  const records = personalRecords([activity, ...others.filter((o) => o.id !== activity.id)]);
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Best efforts" />
      <ul className="mt-4 divide-y divide-hairline">
        {activity.bestEfforts.map((e) => {
          const d = RECORD_DISTANCES.find((x) => x.key === e.key);
          if (!d) return null;
          const isRecord = records.some((r) => r.distance.key === e.key && r.activityId === activity.id);
          return (
            <li key={e.key} className="flex items-baseline justify-between gap-4 py-2.5 text-[13px]">
              <span className="font-bold text-ink-secondary">{d.label}</span>
              <span className="tabular-nums">
                <span className="font-bold text-ink">{formatDuration(e.elapsedS)}</span>
                <span className="ml-2 text-ink-tertiary">{formatPace(pace(e, d.metres), units)}</span>
                {isRecord && <span className="im-micro ml-3 text-mint">Record</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
