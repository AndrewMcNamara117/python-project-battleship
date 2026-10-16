import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { Rise } from '@/components/motion/Rise';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { FORGE_RULES } from '@/lib/domain/forge-score';
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardScope } from '@/lib/domain/types';
import { LeaderboardTabs } from './LeaderboardTabs';

export const metadata: Metadata = { title: 'Leaderboard' };

const SCOPES: LeaderboardScope[] = ['weekly', 'monthly', 'all_time'];
const CATEGORIES: LeaderboardCategory[] = ['forge_score', 'consistency', 'community', 'streaks'];

export default async function LeaderboardPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // every combination is computed once server-side so switching tabs is instant
  const entries = await Promise.all(
    SCOPES.flatMap((scope) =>
      CATEGORIES.map(async (category) => {
        const rows = await repo.getLeaderboard(scope, category);
        return [`${scope}:${category}`, rows] as const;
      }),
    ),
  );
  const boards = Object.fromEntries(entries) as Record<string, LeaderboardEntry[]>;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Iron Miles"
        title="Forge Score"
        lead="A score built on turning up, not on going furthest."
      />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Rise>
          <StatCard
            label="Forge Score"
            value={ctx.stats.forgeTotal}
            note={
              ctx.stats.tier.next
                ? `${ctx.stats.tier.name} · ${ctx.stats.tier.pointsToNext} points to ${ctx.stats.tier.next}`
                : `${ctx.stats.tier.name} · top tier`
            }
            meter={ctx.stats.tier.progress}
          />
        </Rise>
        <Rise>
          <StatCard label="This week" value={ctx.stats.forgeWeek} suffix=" pts" />
        </Rise>
        <Rise>
          <StatCard label="This month" value={ctx.stats.forgeMonth} suffix=" pts" />
        </Rise>
        <Rise>
          <StatCard label="Week streak" value={ctx.stats.streakWeeks} note="Weeks in a row that earned points." />
        </Rise>
      </div>

      <div className="mt-10">
        <LeaderboardTabs
          boards={boards}
          meId={ctx.session.userId}
          optedIn={ctx.profile.leaderboardOptIn}
        />
      </div>

      <section className="mt-12">
        <Panel className="p-6 sm:p-8">
          <PanelHeader
            label="How points are earned"
            action={
              <span className="text-[11px] text-muted-2">
                Items marked &ldquo;coach records&rdquo; are not detected automatically yet
              </span>
            }
          />
          <ul className="mt-6 divide-y divide-line">
            {FORGE_RULES.map((rule) => (
              <li key={rule.kind} className="flex items-center gap-5 py-4">
                <span className="im-mono w-14 shrink-0 text-[15px] font-extrabold text-green">
                  {rule.points > 0 ? `+${rule.points}` : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] font-bold">
                    {rule.label}
                    {/* beside the title, wrapping under it on a phone, rather than squeezing it */}
                    {!rule.automatic && <Badge tone="neutral">Coach records</Badge>}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted">{rule.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </AppPage>
  );
}
