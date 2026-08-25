import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { AthleteTable } from '@/components/app/AthleteTable';
import { StatCard } from '@/components/app/StatCard';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { attentionFlag, loadCoachContext } from '@/lib/coach-data';
import { formatDayMonth, greeting } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Coach' };

export default async function CoachOverviewPage() {
  const ctx = await loadCoachContext();
  const firstName = ctx.coach.fullName.split(' ')[0] || 'Coach';
  const attention = ctx.athletes.filter((a) => attentionFlag(a).tone !== 'green');

  return (
    <AppPage>
      <PageHeader
        eyebrow={`${greeting()}, ${firstName}`}
        title="Today's picture"
        lead="Athletes who need something are at the top. Everyone else is fine."
      />

      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <RevealItem>
          <StatCard label="Athletes" value={ctx.totals.athletes} />
        </RevealItem>
        <RevealItem>
          <StatCard label="Need attention" value={ctx.totals.needingAttention} />
        </RevealItem>
        <RevealItem>
          <StatCard label="Check-ins waiting" value={ctx.totals.checkInsWaiting} />
        </RevealItem>
        <RevealItem>
          <StatCard label="Missed sessions" value={ctx.totals.missedSessions} note="Last two weeks, all athletes." />
        </RevealItem>
        <RevealItem>
          <StatCard label="Races in 60 days" value={ctx.totals.upcomingRaces} />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Avg adherence"
            value={ctx.totals.averageAdherence}
            suffix="%"
            meter={ctx.totals.averageAdherence / 100}
          />
        </RevealItem>
      </RevealGroup>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="im-micro">Needs you first</h2>
          <Link
            href="/coach/athletes"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
          >
            All athletes
          </Link>
        </div>

        <RevealGroup className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {attention.map((a) => {
            const flag = attentionFlag(a);
            return (
              <RevealItem key={a.profile.id}>
                <Panel hover className="h-full p-6">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/coach/athletes/${a.profile.id}`}
                      className="text-[15px] font-bold transition-colors hover:text-green"
                    >
                      {a.profile.fullName}
                    </Link>
                    <Badge tone={flag.tone}>{flag.label}</Badge>
                  </div>

                  <p className="im-mono mt-3 text-[12px] text-muted">
                    {a.sessionsThisWeek.completed}/{a.sessionsThisWeek.prescribed} this week ·{' '}
                    {a.weekAdherencePct}% adherence
                    {a.daysToRace != null ? ` · ${a.daysToRace}d to race` : ''}
                  </p>

                  {a.lastCheckIn?.attentionReasons.length ? (
                    <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
                      {a.lastCheckIn.attentionReasons.slice(0, 3).map((r) => (
                        <li key={r} className="text-[12px] leading-relaxed text-muted">
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : a.missedLastTwoWeeks >= 3 ? (
                    <p className="mt-4 border-t border-line pt-4 text-[12px] text-muted">
                      {a.missedLastTwoWeeks} sessions missed in the last two weeks.
                    </p>
                  ) : null}
                </Panel>
              </RevealItem>
            );
          })}
          {!attention.length && (
            <Panel className="p-6">
              <p className="text-[14px] text-muted">Nobody flagged. Everyone is training.</p>
            </Panel>
          )}
        </RevealGroup>
      </section>

      <section className="mt-10">
        <h2 className="im-micro">All athletes</h2>
        <div className="mt-5">
          <AthleteTable athletes={ctx.athletes} />
        </div>
      </section>

      <section className="mt-10">
        <Reveal>
          <Panel className="p-6 sm:p-8">
            <PanelHeader label="Upcoming races" />
            <ul className="mt-6 divide-y divide-line">
              {ctx.upcomingRaces.slice(0, 8).map((r) => (
                <li key={`${r.race.id}-${r.athleteName}`} className="flex items-center gap-5 py-3.5">
                  <span className="im-mono w-14 shrink-0 text-[14px] font-extrabold text-green">
                    {r.daysAway}d
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{r.race.name}</span>
                    <span className="im-micro mt-1 block">
                      {r.athleteName} · {formatDayMonth(r.race.date)}
                    </span>
                  </span>
                </li>
              ))}
              {!ctx.upcomingRaces.length && <p className="text-[14px] text-muted">No races on the calendar.</p>}
            </ul>
          </Panel>
        </Reveal>
      </section>
    </AppPage>
  );
}
