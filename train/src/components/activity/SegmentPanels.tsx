import Link from 'next/link';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
import type { Segment, SegmentEffort, SegmentLeader } from '@/lib/activity/segments';
import { formatDayMonth, formatDuration, formatPace } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';

const paceOf = (elapsedS: number, distanceM: number) => (distanceM > 0 ? Math.round((elapsedS / distanceM) * 1000) : null);

/** Segments timed on one activity, each against the athlete's own best. */
export function ActivitySegments({
  efforts,
  segments,
  history,
  units,
  hrefFor,
}: {
  efforts: SegmentEffort[];
  segments: Segment[];
  /** All the athlete's efforts, to say whether this one is their best. */
  history: SegmentEffort[];
  units: Units;
  hrefFor: (segmentId: string) => string;
}) {
  if (!efforts.length) return null;
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Segments" />
      <ul className="mt-4 divide-y divide-hairline">
        {efforts.map((e) => {
          const seg = segments.find((s) => s.id === e.segmentId);
          if (!seg) return null;
          const mine = history.filter((h) => h.segmentId === e.segmentId);
          const best = mine.length > 1 && mine.every((h) => h.id === e.id || e.elapsedS <= h.elapsedS);
          return (
            <li key={e.id} className="flex items-baseline justify-between gap-4 py-3">
              <Link href={hrefFor(seg.id)} className="min-w-0 truncate text-[14px] font-bold text-ink hover:text-mint">
                {seg.name}
              </Link>
              <span className="shrink-0 text-right text-[13px] tabular-nums">
                <span className="font-bold text-ink">{formatDuration(e.elapsedS)}</span>
                <span className="ml-2 text-ink-tertiary">{formatPace(paceOf(e.elapsedS, seg.distanceM), units)}</span>
                {best && <span className="im-micro ml-3 text-mint">Your best</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The club board for one segment. */
export function SegmentBoard({
  leaders,
  segment,
  viewerId,
  units,
}: {
  leaders: SegmentLeader[];
  segment: Segment;
  viewerId: string;
  units: Units;
}) {
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Club board" action={<span className="im-micro text-ink-tertiary">Best per athlete</span>} />
      {leaders.length ? (
        <ol className="mt-4 divide-y divide-hairline">
          {leaders.map((l, i) => (
            <li
              key={l.athleteId}
              className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 text-[13px] ${l.athleteId === viewerId ? 'text-mint' : ''}`}
            >
              <span className="tabular-nums text-ink-tertiary">{i + 1}</span>
              <span className="min-w-0 truncate font-bold">
                {l.athleteId === viewerId ? 'You' : l.athleteName}
                <span className="ml-2 font-normal text-ink-tertiary">{formatDayMonth(l.startedAt.slice(0, 10))}</span>
              </span>
              <span className="text-right tabular-nums">
                <span className="font-bold">{formatDuration(l.elapsedS)}</span>
                <span className="ml-2 text-ink-tertiary">{formatPace(paceOf(l.elapsedS, segment.distanceM), units)}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-[13px] text-ink-secondary">No shared runs on it yet.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
        Only runs shared with the club count here. A time from a run you kept private is yours alone.
      </p>
    </Panel>
  );
}

/** One athlete's history on a segment, newest first, best marked. */
export function SegmentHistory({
  efforts,
  segment,
  units,
  activityHref,
}: {
  efforts: SegmentEffort[];
  segment: Segment;
  units: Units;
  activityHref?: (activityId: string) => string;
}) {
  const best = efforts.length ? Math.min(...efforts.map((e) => e.elapsedS)) : null;
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Your efforts" action={best != null ? <span className="im-micro text-mint">Best {formatDuration(best)}</span> : undefined} />
      {efforts.length ? (
        <ul className="mt-4 divide-y divide-hairline">
          {efforts.map((e) => {
            const row = (
              <>
                <span className="text-ink-secondary">{formatDayMonth(e.startedAt.slice(0, 10))}</span>
                <span className="text-right tabular-nums">
                  <span className={`font-bold ${e.elapsedS === best ? 'text-mint' : 'text-ink'}`}>{formatDuration(e.elapsedS)}</span>
                  <span className="ml-2 text-ink-tertiary">{formatPace(paceOf(e.elapsedS, segment.distanceM), units)}</span>
                </span>
              </>
            );
            return (
              <li key={e.id}>
                {activityHref ? (
                  <Link href={activityHref(e.activityId)} className="flex items-baseline justify-between gap-4 py-2.5 text-[13px] hover:bg-slate/40">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-baseline justify-between gap-4 py-2.5 text-[13px]">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-ink-secondary">
          Not run yet — or not since the segment was drawn. Times come from files imported after a segment exists.
        </p>
      )}
    </Panel>
  );
}
