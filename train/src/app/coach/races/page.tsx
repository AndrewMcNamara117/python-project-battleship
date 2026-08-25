import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { loadCoachContext } from '@/lib/coach-data';
import { getRepo } from '@/lib/data';
import { formatDate } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Race calendar' };

export default async function RacesPage() {
  const ctx = await loadCoachContext();
  const repo = await getRepo();
  const races = await repo.listRaces();

  const upcoming = races.filter((r) => r.date >= ctx.today);
  const past = races.filter((r) => r.date < ctx.today).reverse();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Calendar"
        title="Races"
        lead="Every start line your athletes are pointed at, and who is running which."
        action={<Badge tone="neutral">{upcoming.length} upcoming</Badge>}
      />

      <Reveal>
        <Panel className="mt-8 overflow-hidden p-0">
          <ul>
            {upcoming.map((race) => {
              const athletes = ctx.athletes.filter((a) => a.race?.id === race.id);
              const days = Math.round(
                (new Date(`${race.date}T00:00:00Z`).getTime() -
                  new Date(`${ctx.today}T00:00:00Z`).getTime()) /
                  86_400_000,
              );
              return (
                <li key={race.id} className="border-b border-line px-6 py-5 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="im-display text-[1.15rem]">{race.name}</h3>
                      <p className="im-mono mt-2 text-[12px] text-muted">
                        {formatDate(race.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                        {race.location ? ` · ${race.location}` : ''}
                        {race.distanceKm ? ` · ${race.distanceKm}K` : ''}
                        {race.elevationM ? ` · ${race.elevationM}m` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone="neutral">{EVENT_TYPE_LABELS[race.eventType]}</Badge>
                      <span className="im-mono text-[15px] font-extrabold text-green">{days}d</span>
                    </div>
                  </div>

                  {athletes.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                      {athletes.map((a) => (
                        <li key={a.profile.id}>
                          <Link
                            href={`/coach/athletes/${a.profile.id}`}
                            className="rounded-xs border border-line-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted transition-colors hover:border-green hover:text-green"
                          >
                            {a.profile.fullName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {!upcoming.length && (
              <li className="px-6 py-8">
                <p className="text-[14px] text-muted">No upcoming races on the calendar.</p>
              </li>
            )}
          </ul>
        </Panel>
      </Reveal>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="im-micro">Past</h2>
          <Panel className="mt-5 overflow-hidden p-0">
            <ul>
              {past.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 border-b border-line px-6 py-3.5 last:border-b-0">
                  <span className="text-[13px] text-muted">{r.name}</span>
                  <span className="im-mono text-[11px] text-muted-2">{formatDate(r.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </AppPage>
  );
}
