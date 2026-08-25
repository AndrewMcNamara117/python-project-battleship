import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { formatDayMonth } from '@/lib/domain/dates';
import { AttendButton } from './AttendButton';

export const metadata: Metadata = { title: 'Community' };

const KIND_LABEL: Record<string, string> = {
  club_run: 'Club run',
  race: 'Race',
  session: 'Session',
  social: 'Social',
  volunteer: 'Volunteer',
};

const POST_LABEL: Record<string, string> = {
  announcement: 'Announcement',
  milestone: 'Milestone',
  shoutout: 'Shoutout',
};

export default async function CommunityPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const [events, posts, races] = await Promise.all([
    repo.listCommunityEvents(),
    repo.listCommunityPosts(),
    repo.listRaces(),
  ]);

  const upcomingRaces = races.filter((r) => r.date >= ctx.today).slice(0, 4);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Iron Miles"
        title="You're not training alone."
        lead="Sessions, races, and the people doing the same work as you. No feeds, no follower counts."
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <section>
            <h2 className="im-micro">Coming up</h2>
            <RevealGroup className="mt-4 space-y-4">
              {events.map((e) => {
                const full = e.capacity != null && e.attendingCount >= e.capacity;
                return (
                  <RevealItem key={e.id}>
                    <Panel hover className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Badge tone={e.kind === 'volunteer' ? 'green' : 'neutral'}>
                              {KIND_LABEL[e.kind] ?? e.kind}
                            </Badge>
                            <span className="im-mono text-[11px] tracking-[0.12em] text-muted-2">
                              {new Date(e.startsAt).toLocaleString('en-IE', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <h3 className="im-display mt-3.5 text-[1.25rem]">{e.title}</h3>
                          <p className="mt-2 text-[12px] text-muted-2">{e.location}</p>
                          <p className="mt-3 max-w-[56ch] text-[13px] leading-relaxed text-muted">
                            {e.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-3">
                          <span className="im-mono text-[12px] text-muted">
                            {e.attendingCount}
                            {e.capacity ? ` / ${e.capacity}` : ''} going
                          </span>
                          <AttendButton eventId={e.id} full={full} />
                        </div>
                      </div>
                    </Panel>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </section>

          <section className="pt-6">
            <h2 className="im-micro">From the club</h2>
            <RevealGroup className="mt-4 space-y-4">
              {posts.map((p) => (
                <RevealItem key={p.id}>
                  <Panel className="p-6">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge tone={p.kind === 'milestone' ? 'green' : 'neutral'}>
                        {POST_LABEL[p.kind] ?? p.kind}
                      </Badge>
                      <span className="im-micro">{p.authorName}</span>
                      <span className="im-mono text-[11px] text-muted-2">
                        {formatDayMonth(p.createdAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="mt-4 text-[15px] leading-relaxed text-white">{p.body}</p>
                    <div className="mt-5 flex gap-4 border-t border-line pt-4">
                      {Object.entries(p.reactions).map(([key, count]) => (
                        <span key={key} className="im-micro">
                          {key} · {count}
                        </span>
                      ))}
                    </div>
                  </Panel>
                </RevealItem>
              ))}
            </RevealGroup>
          </section>
        </div>

        <div className="space-y-5">
          <Reveal>
            <Panel className="p-6">
              <PanelHeader label="Race calendar" />
              <ul className="mt-5 space-y-4">
                {upcomingRaces.map((r) => (
                  <li key={r.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                    <p className="text-[14px] font-bold">{r.name}</p>
                    <p className="im-mono mt-1.5 text-[11px] tracking-[0.12em] text-muted-2">
                      {formatDayMonth(r.date)}
                      {r.distanceKm ? ` · ${r.distanceKm}K` : ''}
                      {r.location ? ` · ${r.location}` : ''}
                    </p>
                  </li>
                ))}
                {!upcomingRaces.length && <p className="text-[13px] text-muted">Nothing on the calendar yet.</p>}
              </ul>
            </Panel>
          </Reveal>

          <Reveal delay={0.06}>
            <Panel className="p-6">
              <PanelHeader label="Your training group" />
              <p className="mt-4 text-[14px] leading-relaxed text-muted">
                Groups are set by your coach based on the block you are in. Yours shows on the
                leaderboard beside your name.
              </p>
              <Link
                href="/app/leaderboard"
                className="mt-5 block border-t border-line pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
              >
                Open the leaderboard
              </Link>
            </Panel>
          </Reveal>
        </div>
      </div>
    </AppPage>
  );
}
