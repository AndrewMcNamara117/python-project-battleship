import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { distanceLabel } from '@/components/activity/ActivityPanels';
import { RouteMap } from '@/components/activity/RouteMap';
import { CommentThread, KudosButton } from '@/components/activity/Social';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { Rise } from '@/components/motion/Rise';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { formatDuration, formatLongDate, formatPace } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Club run' };

/** A club-mate's shared run: the run, the kudos, the conversation. */
export default async function ClubRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const repo = await getRepo();
  const item = await repo.getFeedItem(session.userId, id);
  if (!item) notFound();
  if (item.athleteId === session.userId) redirect(`/app/activities/${id}`);

  const [profile, social] = await Promise.all([repo.getProfile(session.userId), repo.getActivitySocial(session.userId, id)]);
  const units = profile?.units ?? 'metric';
  const label = `${item.name} by ${item.athleteName}, ${formatLongDate(item.localDate)} — ${distanceLabel(item.distanceM, units)} in ${formatDuration(item.movingS)}`;

  return (
    <AppPage>
      <AppHeader
        eyebrow={`${item.athleteName} · ${formatLongDate(item.localDate)}`}
        title={item.name}
        action={
          <ButtonLink href="/app/club" variant="ghost" size="sm">
            Club feed
          </ButtonLink>
        }
      />
      <div className="mx-auto mt-7 max-w-3xl space-y-5">
        <Rise>
          <Panel edge className="p-0">
            <RouteMap route={item.route} trimM={item.privacyTrimM} label={`Route of ${label}`} />
          </Panel>
        </Rise>
        <Rise delay={40}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-hairline bg-hairline sm:grid-cols-4">
            {[
              ['Distance', distanceLabel(item.distanceM, units)],
              ['Moving time', formatDuration(item.movingS)],
              ['Pace', formatPace(item.avgPaceSecPerKm, units)],
              ['Climb', item.ascentM != null ? (units === 'imperial' ? `${Math.round(item.ascentM * 3.28084)} ft` : `${item.ascentM} m`) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-charcoal px-4 py-4">
                <dt className="im-micro">{k}</dt>
                <dd className="im-figure mt-2 text-[clamp(1.2rem,2.4vw,1.5rem)]">{v}</dd>
              </div>
            ))}
          </dl>
        </Rise>
        <Rise delay={60}>
          <Panel className="p-5 sm:p-6">
            <SectionHeading
              label="Kudos"
              action={<KudosButton activityId={item.id} given={item.viewerKudos} count={item.kudosCount} />}
            />
            {social.kudos.length > 0 && (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">{social.kudos.map((k) => k.name).join(', ')}</p>
            )}
          </Panel>
        </Rise>
        <Rise delay={80}>
          <Panel className="p-5 sm:p-6">
            <SectionHeading label="Comments" />
            <div className="mt-4">
              <CommentThread
                activityId={item.id}
                comments={social.comments}
                viewerId={session.userId}
                canModerate={false}
                canComment
              />
            </div>
          </Panel>
        </Rise>
      </div>
    </AppPage>
  );
}
