import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatPrice, PACKAGES, packageByCode } from '@/data/packages';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { formatDate } from '@/lib/domain/dates';
import { hasStripe } from '@/lib/env';
import { BillingActions } from './BillingActions';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const session = await requireSession();
  const repo = await getRepo();
  const subscription = await repo.getSubscription(session.userId);
  const pkg = subscription ? packageByCode(subscription.packageCode) : PACKAGES[0];

  return (
    <AppPage>
      <PageHeader
        eyebrow="Account"
        title="Billing"
        lead="Monthly, cancel any time. Coaching runs to the end of the period you have paid for."
        action={
          <ButtonLink href="/app/profile" variant="ghost" size="sm">
            Back to profile
          </ButtonLink>
        }
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <Reveal>
          <Panel edge className="p-6 sm:p-8">
            <PanelHeader
              label="Current plan"
              action={
                subscription ? (
                  <Badge tone={subscription.status === 'active' ? 'green' : 'warn'}>
                    {subscription.status.replace('_', ' ')}
                  </Badge>
                ) : (
                  <Badge tone="neutral">None</Badge>
                )
              }
            />

            <h2 className="im-display mt-6 text-[clamp(1.5rem,3vw,2rem)]">
              {pkg?.name ?? 'Event Ready Coaching'}
            </h2>
            <p className="im-mono mt-3 text-[15px] font-extrabold text-green">
              {formatPrice(subscription?.priceCents ?? PACKAGES[0].priceCents)} / month
            </p>

            {subscription?.currentPeriodEnd && (
              <p className="mt-4 text-[13px] text-muted">
                {subscription.cancelAtPeriodEnd ? 'Access ends on ' : 'Renews on '}
                {formatDate(subscription.currentPeriodEnd.slice(0, 10), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                .
              </p>
            )}

            {subscription?.status === 'past_due' && (
              <div className="mt-6 border border-alert/40 bg-alert/8 p-5">
                <p className="im-micro text-alert">Payment failed</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white">
                  Your last payment did not go through. Update your card to keep coaching active —
                  your programme and history are untouched in the meantime.
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-line pt-7">
              {hasStripe ? (
                <BillingActions hasSubscription={Boolean(subscription?.stripeCustomerId)} />
              ) : (
                <div>
                  <p className="im-micro text-warn">Billing not configured</p>
                  <p className="mt-2.5 max-w-[56ch] text-[13px] leading-relaxed text-muted">
                    This deployment has no Stripe keys attached, so checkout and the billing portal
                    are unavailable. Set <code className="text-white">STRIPE_SECRET_KEY</code>,{' '}
                    <code className="text-white">STRIPE_WEBHOOK_SECRET</code> and{' '}
                    <code className="text-white">STRIPE_PRICE_EVENT_READY</code> to enable them.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        </Reveal>

        <div className="space-y-5">
          <Reveal delay={0.06}>
            <Panel className="p-6">
              <PanelHeader label="What's included" />
              <ul className="mt-5 space-y-3">
                {(pkg ?? PACKAGES[0]).includes.map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-relaxed text-white">
                    <span aria-hidden className="mt-2 block h-px w-4 shrink-0 bg-green" />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>

          <Reveal delay={0.1}>
            <Panel className="p-6">
              <PanelHeader label="Pausing and cancelling" />
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                Pause if you are injured, travelling or life has got in the way — your programme,
                history and analytics stay exactly where you left them.
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                Cancel and coaching runs to the end of the current period. No notice period, no exit
                conversation, and your data is still yours to export.
              </p>
            </Panel>
          </Reveal>
        </div>
      </div>
    </AppPage>
  );
}
