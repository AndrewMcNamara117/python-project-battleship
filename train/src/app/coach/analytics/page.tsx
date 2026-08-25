import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatPrice, PACKAGES } from '@/data/packages';
import { attentionFlag, loadCoachContext } from '@/lib/coach-data';

export const metadata: Metadata = { title: 'Analytics' };

export default async function CoachAnalyticsPage() {
  const ctx = await loadCoachContext();

  const monthlyRevenueCents = ctx.totals.athletes * PACKAGES[0].priceCents;
  const onTrack = ctx.athletes.filter((a) => attentionFlag(a).tone === 'green').length;
  const checkInRate = ctx.athletes.length
    ? Math.round((ctx.athletes.filter((a) => !a.checkInDue).length / ctx.athletes.length) * 100)
    : 0;

  // adherence banded, so the shape of the roster is visible without a chart
  const bands = [
    { label: '90–100%', test: (n: number) => n >= 90 },
    { label: '70–89%', test: (n: number) => n >= 70 && n < 90 },
    { label: '50–69%', test: (n: number) => n >= 50 && n < 70 },
    { label: 'Under 50%', test: (n: number) => n < 50 },
  ].map((b) => ({
    ...b,
    count: ctx.athletes.filter((a) => b.test(a.weekAdherencePct)).length,
  }));
  const maxBand = Math.max(1, ...bands.map((b) => b.count));

  return (
    <AppPage>
      <PageHeader
        eyebrow="Business and coaching"
        title="Analytics"
        lead="How the roster is doing, and what it is worth."
      />

      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatCard label="Active athletes" value={ctx.totals.athletes} />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Monthly recurring"
            value={monthlyRevenueCents / 100}
            prefix="€"
            note={`At ${formatPrice(PACKAGES[0].priceCents)} per athlete.`}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="On track"
            value={onTrack}
            meter={ctx.totals.athletes ? onTrack / ctx.totals.athletes : 0}
            note={`${ctx.totals.athletes - onTrack} flagged.`}
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Check-in rate"
            value={checkInRate}
            suffix="%"
            meter={checkInRate / 100}
            note="Athletes who have checked in this week."
          />
        </RevealItem>
      </RevealGroup>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Panel className="h-full p-6 sm:p-8">
            <PanelHeader label="Weekly adherence across the roster" />
            <ul className="mt-7 space-y-5">
              {bands.map((b) => (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-bold uppercase tracking-[0.1em]">{b.label}</span>
                    <span className="im-mono text-[13px] font-bold">{b.count}</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full bg-line">
                    <div
                      className="h-1.5 rounded-[2px] bg-green"
                      style={{ width: `${(b.count / maxBand) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel className="h-full p-6 sm:p-8">
            <PanelHeader label="Operational load" />
            <dl className="mt-7 space-y-5">
              {[
                ['Check-ins waiting', ctx.totals.checkInsWaiting],
                ['Athletes needing attention', ctx.totals.needingAttention],
                ['Missed sessions, last 2 weeks', ctx.totals.missedSessions],
                ['Races within 60 days', ctx.totals.upcomingRaces],
                ['Average weekly adherence', `${ctx.totals.averageAdherence}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-4 border-b border-line pb-4 last:border-b-0">
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="im-mono text-[16px] font-extrabold">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel className="mt-6 p-6 sm:p-8">
          <PanelHeader
            label="Capacity"
            action={<Badge tone="neutral">Founding cohort</Badge>}
          />
          <p className="mt-5 max-w-[64ch] text-[14px] leading-relaxed text-muted">
            {PACKAGES[0].foundingSpots
              ? `${PACKAGES[0].foundingSpots.remaining} of ${PACKAGES[0].foundingSpots.total} founding places remain. Individual coaching does not scale by adding seats — the number here is the number a person can actually coach well.`
              : 'Individual coaching does not scale by adding seats.'}
          </p>
        </Panel>
      </Reveal>
    </AppPage>
  );
}
