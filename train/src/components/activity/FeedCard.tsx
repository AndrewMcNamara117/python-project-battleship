import Link from 'next/link';
import { Panel } from '@/components/ui/Panel';
import type { FeedItem } from '@/lib/activity/types';
import { formatDayMonth, formatDuration, formatPace } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';
import { distanceLabel } from './ActivityPanels';
import { RouteMap } from './RouteMap';
import { KudosButton } from './Social';

/** One shared run in the feed: who, what, the line, and the two social counts. */
export function FeedCard({ item, units, viewerId, href }: { item: FeedItem; units: Units; viewerId: string; href: string }) {
  const own = item.athleteId === viewerId;
  return (
    <Panel as="article" className="overflow-hidden p-0">
      <header className="flex items-center gap-3 px-5 pt-5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mint/50 text-[12px] font-bold text-mint"
          aria-hidden
        >
          {item.athleteName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-ink">
            {own ? 'You' : item.athleteName}
            {item.trainingGroup && <span className="ml-2 font-normal text-ink-tertiary">{item.trainingGroup}</span>}
          </p>
          <p className="text-[12px] text-ink-tertiary">{formatDayMonth(item.localDate)}</p>
        </div>
      </header>

      <Link href={href} className="group block px-5 pt-3">
        <h3 className="text-[17px] font-bold text-ink group-hover:text-mint">{item.name}</h3>
        <dl className="mt-3 grid grid-cols-4 gap-3">
          {[
            ['Distance', distanceLabel(item.distanceM, units)],
            ['Time', formatDuration(item.movingS)],
            ['Pace', formatPace(item.avgPaceSecPerKm, units).replace(/ \/.+$/, '')],
            ['Climb', item.ascentM != null ? `${units === 'imperial' ? Math.round(item.ascentM * 3.28084) + ' ft' : item.ascentM + ' m'}` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="im-micro">{label}</dt>
              <dd className="mt-1 truncate text-[14px] font-bold tabular-nums text-ink-body">{value}</dd>
            </div>
          ))}
        </dl>
      </Link>

      <Link href={href} tabIndex={-1} aria-hidden className="mt-4 block border-y border-hairline">
        <RouteMap route={item.route} trimM={item.privacyTrimM} label="" compact height={150} className="h-[150px] w-full" />
      </Link>

      <footer className="flex items-center justify-between gap-4 px-5 py-3">
        <KudosButton activityId={item.id} given={item.viewerKudos} count={item.kudosCount} disabled={own} />
        <Link href={href} className="text-[12px] font-bold text-ink-secondary hover:text-mint">
          {item.commentCount ? `${item.commentCount} comment${item.commentCount === 1 ? '' : 's'}` : 'Comment'}
        </Link>
      </footer>
    </Panel>
  );
}
