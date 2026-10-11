import type { Metadata } from 'next';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { MetricCard } from '@/components/forge/MetricCard';
import { ProgressRing } from '@/components/forge/ProgressRing';
import { HeartRateChart, PaceChart } from '@/components/charts/TrainingCharts';
import { Rise } from '@/components/motion/Rise';
import { StatusTag, adherenceTone } from '@/components/ui/StatusTag';
import { Panel } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { formatDate, formatDistance, formatPace } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Progress' };

/**
 * PROGRESS — is the work actually adding up?
 *
 * The screen answers that in its first line and then supports it. Deliberately
 * not a wall of charts: four figures, three ForgeLines carrying the shapes that
 * matter, two charts where a real axis is needed, and a table for anyone who
 * wants the numbers rather than the picture.
 *
 * Prescribed sits against completed everywhere, because volume without the
 * prescription it was measured against says nothing about whether the athlete
 * is doing their programme.
 */
export default async function ProgressPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const achievements = await repo.listAchievements(ctx.session.userId);

  const units = ctx.profile.units;
  const buckets = ctx.buckets;

  const totalKm = buckets.reduce((a, b) => a + b.actualKm, 0);
  const plannedKm = buckets.reduce((a, b) => a + b.plannedKm, 0);
  const longest = Math.max(0, ...buckets.map((b) => b.longestRunKm));
  const strengthPlanned = buckets.reduce((a, b) => a + b.strengthPlanned, 0);
  const strengthDone = buckets.reduce((a, b) => a + b.strengthCompleted, 0);
  const strengthPct = strengthPlanned ? Math.round((strengthDone / strengthPlanned) * 100) : 0;

  const volumeSeries = buckets.map((b) => b.actualKm);
  const plannedSeries = buckets.map((b) => b.plannedKm);
  const longRunSeries = buckets.map((b) => b.longestRunKm);
  const adherenceSeries = buckets.map((b) =>
    b.plannedSessions ? Math.round((b.completedSessions / b.plannedSessions) * 100) : 0,
  );

  // the honest headline: is volume trending up, and is it being completed?
  const firstHalf = volumeSeries.slice(0, Math.floor(volumeSeries.length / 2));
  const secondHalf = volumeSeries.slice(Math.floor(volumeSeries.length / 2));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const trending = avg(secondHalf) - avg(firstHalf);

  const verdict =
    ctx.stats.blockAdherencePct >= 85 && trending > 1
      ? 'Yes. Volume is building and you are completing what was set.'
      : ctx.stats.blockAdherencePct >= 85
        ? 'Yes. You are completing what was set — volume is holding steady by design.'
        : ctx.stats.blockAdherencePct >= 65
          ? 'Mostly. The sessions you are doing are landing; the gaps are what to close.'
          : 'Not yet. Too much of the programme is going unlogged to build on.';

  return (
    <AppPage>
      <AppHeader
        eyebrow="Last 12 weeks"
        title="Is the work adding up?"
        lead={verdict}
        figure={{ value: `${ctx.stats.blockAdherencePct}%`, label: 'of the plan completed' }}
      />

      {/* ---- the four figures ---- */}
      <div className="mt-7 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Rise>
          <MetricCard
            label="Volume completed"
            value={totalKm}
            decimals={0}
            suffix={units === 'metric' ? 'km' : 'mi'}
            emphasis
            meter={plannedKm ? totalKm / plannedKm : 0}
            note={`Against ${formatDistance(plannedKm, units)} prescribed`}
          >
            <ForgeLine
              variant="load"
              data={volumeSeries}
              reference={plannedSeries}
              label="Weekly volume against prescribed"
              unit={units === 'metric' ? 'km' : 'mi'}
              className="mt-4 w-full"
              height={42}
            />
          </MetricCard>
        </Rise>

        <Rise delay={40}>
          <MetricCard
            label="Adherence"
            value={ctx.stats.blockAdherencePct}
            suffix="%"
            meter={ctx.stats.blockAdherencePct / 100}
            note="Sessions completed against sessions prescribed"
          >
            <div className="mt-4">
              <StatusTag tone={adherenceTone(ctx.stats.blockAdherencePct)}>
                {ctx.stats.blockAdherencePct >= 90
                  ? 'On the plan'
                  : ctx.stats.blockAdherencePct >= 70
                    ? 'Holding'
                    : 'Slipping'}
              </StatusTag>
            </div>
          </MetricCard>
        </Rise>

        <Rise delay={80}>
          <MetricCard
            label="Consistency"
            value={ctx.stats.consistencyPct}
            suffix="%"
            meter={ctx.stats.consistencyPct / 100}
            note="Weeks in which you trained at all"
          >
            <ForgeLine
              variant="performance"
              data={adherenceSeries}
              label="Weekly adherence"
              unit="%"
              className="mt-4 w-full"
              height={42}
              delay={80}
            />
          </MetricCard>
        </Rise>

        <Rise delay={120}>
          <MetricCard
            label="Longest run"
            value={longest}
            decimals={1}
            suffix={units === 'metric' ? 'km' : 'mi'}
            note="Your furthest single session in the block"
          >
            <ForgeLine
              variant="elevation"
              data={longRunSeries}
              label="Longest run each week"
              unit={units === 'metric' ? 'km' : 'mi'}
              className="mt-4 w-full"
              height={42}
              delay={120}
            />
          </MetricCard>
        </Rise>
      </div>

      {/* ---- race preparation and strength ---- */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Rise>
          <Panel className="p-5 sm:p-7">
            <SectionHeading
              label="Long-run progression"
              action={
                ctx.daysToRace != null ? (
                  <span className="im-mono text-[11px] tracking-[0.12em] text-ink-secondary">
                    {ctx.daysToRace} days to {ctx.race?.name ?? 'race'}
                  </span>
                ) : undefined
              }
            />
            <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-ink-secondary">
              The single most predictive line in endurance training. It should rise, step back, and
              rise again — a straight climb is how athletes get injured.
            </p>
            <ForgeLine
              variant="elevation"
              data={longRunSeries}
              label="Longest run each week over the block"
              unit={units === 'metric' ? 'km' : 'mi'}
              className="mt-6 w-full"
              height={132}
            />
            <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-hairline pt-4">
              <p className="im-mono text-[12px] text-ink-secondary">
                Now <span className="font-bold text-ink">{formatDistance(longRunSeries.at(-1) ?? 0, units)}</span>
              </p>
              <p className="im-mono text-[12px] text-ink-secondary">
                Furthest <span className="font-bold text-ink">{formatDistance(longest, units)}</span>
              </p>
              {ctx.race?.distanceKm != null && (
                <p className="im-mono text-[12px] text-ink-secondary">
                  Race <span className="font-bold text-ink">{formatDistance(ctx.race.distanceKm, units)}</span>
                </p>
              )}
            </div>
          </Panel>
        </Rise>

        <Rise delay={60}>
          <Panel className="flex h-full flex-col p-5 sm:p-7">
            <SectionHeading label="Strength completion" />
            <div className="mt-6 flex items-center gap-6">
              <ProgressRing value={strengthPlanned ? strengthDone / strengthPlanned : 0} size={104} label="Strength completion">
                <span className="im-figure block text-[1.4rem] text-ink">{strengthPct}%</span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="text-[14px] leading-relaxed text-ink-body">
                  {strengthDone} of {strengthPlanned} prescribed sessions completed.
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
                  Strength is the work that keeps the running possible. It is also the first thing
                  most athletes drop when a week gets tight.
                </p>
              </div>
            </div>

            {achievements.length > 0 && (
              <div className="mt-auto border-t border-hairline pt-5" style={{ marginTop: 'auto' }}>
                <SectionHeading label="Milestones" />
                <ul className="mt-4 space-y-3.5">
                  {achievements.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink-body">{a.title}</p>
                        <p className="mt-0.5 text-[12px] text-ink-secondary">{a.description}</p>
                      </div>
                      <span className="im-mono shrink-0 text-[10px] text-ink-tertiary">
                        {formatDate(a.earnedAt.slice(0, 10), { month: 'short', year: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
                  Milestones are recorded by your coach — the platform does not award them
                  automatically yet.
                </p>
              </div>
            )}
          </Panel>
        </Rise>
      </div>

      {/* ---- the two trends that need a real axis ---- */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
        <Rise>
          <Panel className="h-full p-5 sm:p-7">
            <PaceChart data={buckets} height={190} />
          </Panel>
        </Rise>
        <Rise delay={60}>
          <Panel className="h-full p-5 sm:p-7">
            <HeartRateChart data={buckets} height={190} />
          </Panel>
        </Rise>
      </div>

      {/* ---- the numbers, for anyone who wants them ---- */}
      <Rise>
        <Panel className="mt-5 p-5 sm:p-7">
          <SectionHeading
            label="Week by week"
            action={
              <span className="im-mono text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
                Most recent first
              </span>
            }
          />
          <div className="im-scroll mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline-strong">
                  {['Week', 'Prescribed', 'Completed', 'Volume', 'Longest', 'Avg pace', 'Avg RPE'].map((h) => (
                    <th key={h} className="im-micro pb-3 pr-6 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="im-mono text-[13px]">
                {[...buckets].reverse().map((b) => (
                  <tr key={b.weekStart} className="border-b border-hairline">
                    <td className="py-3 pr-6 text-ink-secondary">{b.weekStart}</td>
                    <td className="py-3 pr-6 text-ink-body">{b.plannedSessions}</td>
                    <td className="py-3 pr-6 font-bold text-mint">{b.completedSessions}</td>
                    <td className="py-3 pr-6 text-ink-body">{formatDistance(b.actualKm, units)}</td>
                    <td className="py-3 pr-6 text-ink-body">{formatDistance(b.longestRunKm, units)}</td>
                    <td className="py-3 pr-6 text-ink-body">{formatPace(b.avgPaceSecPerKm, units)}</td>
                    <td className="py-3 pr-6 text-ink-body">{b.avgRpe ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Rise>

      <p className="mt-6 text-[11px] leading-relaxed text-ink-tertiary">
        Wellbeing trends from your weekly check-ins are on the check-in screen, where they sit
        beside the answers that explain them.
      </p>
    </AppPage>
  );
}
