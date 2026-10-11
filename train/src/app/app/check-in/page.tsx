import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { ForgeMessageCard } from '@/components/app/ForgeMessageCard';
import { WellbeingSmallMultiples } from '@/components/charts/TrainingCharts';
import { Rise } from '@/components/motion/Rise';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { wellbeingSeries } from '@/lib/domain/analytics';
import { attentionLabel } from '@/lib/domain/checkin-rules';
import { addDays, formatDayMonth, startOfWeek } from '@/lib/domain/dates';
import { weeklySummary } from '@/lib/forge/assistant';
import { CheckInForm } from './CheckInForm';

export const metadata: Metadata = { title: 'Weekly check-in' };

export default async function CheckInPage() {
  const ctx = await loadAthleteContext();

  // you check in on the week that is ending, so Monday–Sunday just gone
  const reviewWeek = startOfWeek(ctx.today);
  const existing = ctx.checkins.find((c) => c.weekStart === reviewWeek) ?? null;
  const history = ctx.checkins.filter((c) => c.weekStart !== reviewWeek).slice(0, 6);

  const summary = weeklySummary({
    profile: ctx.profile,
    today: ctx.today,
    week: ctx.week,
    todaySessions: ctx.todaySessions,
    completedThisWeek: ctx.completedThisWeek,
    lastCheckIn: ctx.checkins[0] ?? null,
    race: ctx.race,
    daysToRace: ctx.daysToRace,
    goalName: ctx.race?.name ?? null,
  });

  return (
    <AppPage>
      <PageHeader
        eyebrow={`Week of ${formatDayMonth(reviewWeek)} – ${formatDayMonth(addDays(reviewWeek, 6))}`}
        title="Weekly check-in"
        lead="Seven scores and six questions. It takes two minutes and it is the part a watch cannot see."
        action={existing ? <Badge tone="green">Submitted</Badge> : <Badge tone="neutral">Open</Badge>}
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <CheckInForm weekStart={reviewWeek} existing={existing} />
        </div>

        <div className="space-y-5">
          <Rise>
            <ForgeMessageCard message={summary} />
          </Rise>

          <Rise delay={60}>
            <Panel className="p-6">
              <PanelHeader label="How this is used" />
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                A small set of rules reads your scores and your words — repeated soreness, poor
                sleep, low motivation, missed sessions, or pain described in free text. If anything
                trips, your check-in moves to the top of your coach&apos;s queue.
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                It is a routing tool, not a clinical one. It never diagnoses anything and it never
                replaces seeing someone qualified.
              </p>
            </Panel>
          </Rise>

          {ctx.checkins.length > 0 && (
            <Rise delay={100}>
              <Panel className="p-6">
                <PanelHeader label="Recent check-ins" />
                <ul className="mt-4 space-y-4">
                  {history.map((c) => (
                    <li key={c.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="im-mono text-[12px] text-muted">{formatDayMonth(c.weekStart)}</span>
                        <Badge
                          tone={
                            c.attentionLevel === 'attention'
                              ? 'alert'
                              : c.attentionLevel === 'watch'
                                ? 'warn'
                                : 'neutral'
                          }
                        >
                          {attentionLabel(c.attentionLevel)}
                        </Badge>
                      </div>
                      {c.coachResponse && (
                        <p className="mt-2.5 border-l-2 border-green pl-3 text-[12px] leading-relaxed text-white">
                          {c.coachResponse}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            </Rise>
          )}
        </div>
      </div>

      {ctx.checkins.length > 1 && (
        <section className="mt-12">
          <Rise>
            <Panel className="p-6 sm:p-8">
              <PanelHeader label="Your trends" />
              <div className="mt-8">
                <WellbeingSmallMultiples data={wellbeingSeries(ctx.checkins)} />
              </div>
            </Panel>
          </Rise>
        </section>
      )}
    </AppPage>
  );
}
