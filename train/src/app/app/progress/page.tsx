import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import {
  HeartRateChart,
  LongRunChart,
  MileageChart,
  PaceChart,
  RpeChart,
  WellbeingSmallMultiples,
} from '@/components/charts/TrainingCharts';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { wellbeingSeries } from '@/lib/domain/analytics';
import { formatDate, formatDistance, formatPace } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Progress' };

export default async function ProgressPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const achievements = await repo.listAchievements(ctx.session.userId);

  const wellbeing = wellbeingSeries(ctx.checkins);
  const totalKm = ctx.buckets.reduce((a, b) => a + b.actualKm, 0);
  const longest = Math.max(0, ...ctx.buckets.map((b) => b.longestRunKm));
  const strengthPlanned = ctx.buckets.reduce((a, b) => a + b.strengthPlanned, 0);
  const strengthDone = ctx.buckets.reduce((a, b) => a + b.strengthCompleted, 0);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Last 12 weeks"
        title="The work adds up."
        lead="Measured against what was prescribed — not against anyone else's week."
      />

      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Total volume"
            value={totalKm}
            decimals={0}
            suffix={ctx.profile.units === 'metric' ? 'km' : 'mi'}
            note="Across the last twelve weeks."
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Adherence"
            value={ctx.stats.blockAdherencePct}
            suffix="%"
            meter={ctx.stats.blockAdherencePct / 100}
            note="Sessions completed against sessions prescribed."
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Consistency"
            value={ctx.stats.consistencyPct}
            suffix="%"
            meter={ctx.stats.consistencyPct / 100}
            note="Weeks in which you trained at all."
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Longest run"
            value={longest}
            decimals={1}
            suffix={ctx.profile.units === 'metric' ? 'km' : 'mi'}
            note="Your furthest single session in the block."
          />
        </RevealItem>
      </RevealGroup>

      <div className="mt-6 grid min-w-0 gap-6">
        <Reveal>
          <Panel className="p-6 sm:p-8">
            <MileageChart data={ctx.buckets} />
          </Panel>
        </Reveal>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Reveal>
            <Panel className="h-full p-6 sm:p-8">
              <LongRunChart data={ctx.buckets} />
            </Panel>
          </Reveal>
          <Reveal delay={0.06}>
            <Panel className="h-full p-6 sm:p-8">
              <PaceChart data={ctx.buckets} />
            </Panel>
          </Reveal>
          <Reveal delay={0.1}>
            <Panel className="h-full p-6 sm:p-8">
              <HeartRateChart data={ctx.buckets} />
            </Panel>
          </Reveal>
          <Reveal delay={0.14}>
            <Panel className="h-full p-6 sm:p-8">
              <RpeChart data={ctx.buckets} />
            </Panel>
          </Reveal>
        </div>

        <Reveal>
          <Panel className="p-6 sm:p-8">
            <PanelHeader
              label="Wellbeing · from your check-ins"
              action={
                <span className="text-[11px] text-muted-2">
                  Visible only to you and your coach
                </span>
              }
            />
            <div className="mt-8">
              <WellbeingSmallMultiples data={wellbeing} />
            </div>
          </Panel>
        </Reveal>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Reveal>
            <Panel className="h-full p-6 sm:p-8">
              <PanelHeader label="Strength compliance" />
              <p className="mt-6 text-[clamp(2rem,4vw,2.6rem)] font-extrabold leading-none">
                {strengthPlanned ? Math.round((strengthDone / strengthPlanned) * 100) : 0}
                <span className="text-[1.4rem] text-muted">%</span>
              </p>
              <p className="mt-3 text-[13px] text-muted">
                {strengthDone} of {strengthPlanned} prescribed strength sessions completed.
              </p>
              <div className="mt-5 h-px w-full bg-line-2">
                <div
                  className="h-px bg-green"
                  style={{ width: `${strengthPlanned ? (strengthDone / strengthPlanned) * 100 : 0}%` }}
                />
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.06}>
            <Panel className="h-full p-6 sm:p-8">
              <PanelHeader label="Milestones" />
              <ul className="mt-6 space-y-5">
                {achievements.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-5 border-b border-line pb-5 last:border-b-0">
                    <div>
                      <p className="text-[14px] font-bold">{a.title}</p>
                      <p className="mt-1 text-[12px] text-muted">{a.description}</p>
                    </div>
                    <span className="im-mono shrink-0 text-[11px] text-muted-2">
                      {formatDate(a.earnedAt.slice(0, 10), { month: 'short', year: 'numeric' })}
                    </span>
                  </li>
                ))}
                {!achievements.length && <p className="text-[14px] text-muted">Nothing recorded yet.</p>}
              </ul>
            </Panel>
          </Reveal>
        </div>

        <Reveal>
          <Panel className="p-6 sm:p-8">
            <PanelHeader
              label="Weekly detail"
              action={<Badge tone="neutral">Table view</Badge>}
            />
            <div className="im-scroll mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-2">
                    {['Week', 'Prescribed', 'Completed', 'Volume', 'Longest', 'Avg pace', 'Avg RPE'].map((h) => (
                      <th key={h} className="im-micro pb-3 pr-6 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="im-mono text-[13px]">
                  {[...ctx.buckets].reverse().map((b) => (
                    <tr key={b.weekStart} className="border-b border-line">
                      <td className="py-3 pr-6 text-muted">{b.weekStart}</td>
                      <td className="py-3 pr-6">{b.plannedSessions}</td>
                      <td className="py-3 pr-6 text-green">{b.completedSessions}</td>
                      <td className="py-3 pr-6">{formatDistance(b.actualKm, ctx.profile.units)}</td>
                      <td className="py-3 pr-6">{formatDistance(b.longestRunKm, ctx.profile.units)}</td>
                      <td className="py-3 pr-6">{formatPace(b.avgPaceSecPerKm, ctx.profile.units)}</td>
                      <td className="py-3 pr-6">{b.avgRpe ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>
      </div>
    </AppPage>
  );
}
