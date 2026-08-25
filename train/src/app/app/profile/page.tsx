import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatPrice, packageByCode } from '@/data/packages';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { formatDate, formatDayMonth } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { DataControls, PrivacyControls, ProfileSettings } from './ProfileSettings';

export const metadata: Metadata = { title: 'Profile' };

const PROVIDER_LABEL: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin Connect',
  coros: 'COROS',
  apple_health: 'Apple Health',
  google_fit: 'Google Fit',
};

export default async function ProfilePage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const [subscription, integrations] = await Promise.all([
    repo.getSubscription(ctx.session.userId),
    repo.listIntegrations(ctx.session.userId),
  ]);

  const pkg = subscription ? packageByCode(subscription.packageCode) : null;

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
          <Reveal>
            <ProfileSettings profile={ctx.profile} />
          </Reveal>
          <Reveal delay={0.06}>
            <PrivacyControls profile={ctx.profile} />
          </Reveal>
          <Reveal delay={0.1}>
            <DataControls email={ctx.profile.email} />
          </Reveal>
        </div>

        <div className="space-y-5">
          <Reveal delay={0.04}>
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
          </Reveal>

          <Reveal delay={0.08}>
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
          </Reveal>

          <Reveal delay={0.12}>
            <Panel className="p-6">
              <PanelHeader label="Connected apps" />
              <ul className="mt-5 space-y-3.5">
                {integrations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-4">
                    <span className="text-[14px]">{PROVIDER_LABEL[i.provider] ?? i.provider}</span>
                    <Badge tone={i.status === 'connected' ? 'green' : 'neutral'}>
                      {i.status === 'connected'
                        ? 'Connected'
                        : i.status === 'coming_soon'
                          ? 'Coming soon'
                          : 'Available'}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-muted-2">
                Manual logging works properly today and takes about twenty seconds a session. Device
                sync is architected for and will connect in a later release — we would rather ship
                one thing that works than five that half do.
              </p>
            </Panel>
          </Reveal>

          <Reveal delay={0.16}>
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
          </Reveal>
        </div>
      </div>
    </AppPage>
  );
}
