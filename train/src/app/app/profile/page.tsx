import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Rise } from '@/components/motion/Rise';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatPrice, packageByCode } from '@/data/packages';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { formatDate, formatDayMonth } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { DataControls, PrivacyControls, ProfileSettings } from './ProfileSettings';
import { ConnectedApps, type ConnectedAppRow } from '@/components/app/ConnectedApps';
import { syncProviders, syncSecret } from '@/lib/sync/providers';

export const metadata: Metadata = { title: 'Profile' };

const PROVIDER_LABEL: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin Connect',
  coros: 'COROS',
  apple_health: 'Apple Health',
  google_fit: 'Google Fit',
};

/** finishConnect's failure codes, in the page's words. Anything else in the URL is ignored. */
const CONNECT_FAILURE: Record<string, string> = {
  state: 'That connection link was not one this page started. Start again from here.',
  expired: 'The connection took too long. Start again.',
  denied: 'Access was not granted, so nothing was connected.',
  refused: 'The watch company did not accept the connection. Try again.',
  taken: 'That watch account is already connected to another Iron Miles athlete.',
  error: 'The connection could not be saved. Try again.',
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ sync?: string; reason?: string }> }) {
  const { sync, reason } = await searchParams;
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const [subscription, integrations] = await Promise.all([
    repo.getSubscription(ctx.session.userId),
    repo.listIntegrations(ctx.session.userId),
  ]);

  const pkg = subscription ? packageByCode(subscription.packageCode) : null;

  const providers = syncProviders();
  const ready = Boolean(syncSecret());
  const appRows: ConnectedAppRow[] = [
    ...providers.map((p) => {
      const i = integrations.find((x) => x.provider === p.name);
      return {
        name: p.name,
        label: p.label,
        available: ready && p.configured(),
        connected: i?.status === 'connected',
        lastSyncAt: i?.lastSyncAt ?? null,
        note: p.configured()
          ? ready
            ? i?.status === 'error'
              ? 'Lost the connection — connect again to keep runs arriving.'
              : null
            : 'Sync is not switched on for this deployment yet.'
          : p.setupRequired,
      };
    }),
    { name: 'apple_health', label: 'Apple Health', available: false, connected: false, lastSyncAt: null, note: 'Needs the phone app. Apps like HealthFit export files that import today.' },
    { name: 'health_connect', label: 'Health Connect (Android)', available: false, connected: false, lastSyncAt: null, note: 'Needs the phone app. Google Fit, its predecessor, is being retired by Google.' },
  ];
  const syncNotice =
    sync?.startsWith('connected:')
      ? { ok: true, text: `${PROVIDER_LABEL[sync.slice(10)] ?? 'Your watch'} is connected. New activities will arrive by themselves.` }
      : sync === 'failed'
        ? { ok: false, text: CONNECT_FAILURE[reason ?? ''] ?? 'The connection did not complete.' }
        : sync === 'unavailable'
          ? { ok: false, text: 'That connection is not available yet.' }
          : null;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Your account"
        title={ctx.profile.fullName}
        lead={ctx.profile.email}
        action={<Badge tone="neutral">{ctx.profile.units === 'metric' ? 'Metric' : 'Imperial'}</Badge>}
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Rise>
            <ProfileSettings profile={ctx.profile} />
          </Rise>
          <Rise delay={60}>
            <PrivacyControls profile={ctx.profile} />
          </Rise>
          <Rise delay={100}>
            <DataControls email={ctx.profile.email} />
          </Rise>
        </div>

        <div className="space-y-5">
          <Rise delay={40}>
            <Panel className="p-6">
              <PanelHeader label="Target race" />
              {ctx.race || ctx.goal ? (
                <>
                  <h3 className="im-display mt-4 text-[1.3rem]">{ctx.race?.name ?? 'Your goal'}</h3>
                  <p className="im-mono mt-2.5 text-[12px] tracking-[0.12em] text-muted">
                    {formatDayMonth(ctx.race?.date ?? ctx.goal!.targetDate)}
                    {ctx.goal ? ` · ${EVENT_TYPE_LABELS[ctx.goal.eventType]}` : ''}
                    {ctx.daysToRace != null ? ` · ${ctx.daysToRace} days` : ''}
                  </p>
                  {ctx.goal?.why && (
                    <blockquote className="mt-5 border-l-2 border-green pl-4 text-[13px] leading-relaxed text-white">
                      {ctx.goal.why}
                    </blockquote>
                  )}
                </>
              ) : (
                <p className="mt-4 text-[14px] text-muted">No goal set yet.</p>
              )}
            </Panel>
          </Rise>

          <Rise delay={80}>
            <Panel className="p-6">
              <PanelHeader
                label="Subscription"
                action={
                  subscription ? (
                    <Badge tone={subscription.status === 'active' ? 'green' : 'warn'}>
                      {subscription.status}
                    </Badge>
                  ) : undefined
                }
              />
              {subscription ? (
                <div className="mt-5">
                  <p className="text-[15px] font-bold">{pkg?.name ?? subscription.packageCode}</p>
                  <p className="im-mono mt-2 text-[13px] text-green">
                    {formatPrice(subscription.priceCents, subscription.currency)} / month
                  </p>
                  {subscription.currentPeriodEnd && (
                    <p className="mt-3 text-[12px] text-muted">
                      {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}{' '}
                      {formatDate(subscription.currentPeriodEnd.slice(0, 10), {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  )}
                  <ButtonLink href="/app/profile/billing" variant="ghost" size="sm" className="mt-5">
                    Manage billing
                  </ButtonLink>
                </div>
              ) : (
                <p className="mt-5 text-[14px] text-muted">No active subscription.</p>
              )}
            </Panel>
          </Rise>

          <Rise delay={120}>
            <Panel className="p-6">
              <PanelHeader label="Connected apps" />
              {syncNotice && (
                <p role="status" className={`mt-4 text-[13px] font-bold ${syncNotice.ok ? 'text-mint' : 'text-status-missed'}`}>
                  {syncNotice.text}
                </p>
              )}
              <ConnectedApps rows={appRows} />
              <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-muted-2">
                Until a watch connects, export a file from it and{' '}
                <Link href="/app/activities" className="text-mint hover:underline">
                  import it
                </Link>
                , or{' '}
                <Link href="/app/record" className="text-mint hover:underline">
                  record in the browser
                </Link>
                . Tokens for a connected account are stored encrypted, readable only by the server.
              </p>
            </Panel>
          </Rise>

          <Rise delay={160}>
            <Panel className="p-6">
              <PanelHeader label="Consent" />
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                {ctx.profile.healthDataConsentAt
                  ? `You consented to Iron Miles processing your training and wellbeing data on ${formatDate(
                      ctx.profile.healthDataConsentAt.slice(0, 10),
                      { day: 'numeric', month: 'long', year: 'numeric' },
                    )}.`
                  : 'No consent recorded yet.'}
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-2">
                Withdrawing consent means ending coaching, since the coaching cannot work without
                the data. Deleting your account above does both.
              </p>
            </Panel>
          </Rise>
        </div>
      </div>
    </AppPage>
  );
}
