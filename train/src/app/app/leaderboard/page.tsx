import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { StatCard } from '@/components/app/StatCard';
import { RevealGroup, RevealItem } from '@/components/motion/Reveal';
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

      <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatCard label="Forge Score" value={ctx.stats.forgeTotal} note={`Tier: ${ctx.stats.tier.name}`} meter={ctx.stats.tier.progress} />
        </RevealItem>
        <RevealItem>
          <StatCard label="This week" value={ctx.stats.forgeWeek} suffix=" pts" />
        </RevealItem>
        <RevealItem>
          <StatCard label="This month" value={ctx.stats.forgeMonth} suffix=" pts" />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Week streak"
            value={ctx.stats.streakWeeks}
            note={
              ctx.stats.tier.next
                ? `${ctx.stats.tier.pointsToNext} points to ${ctx.stats.tier.next}`
                : 'Top tier reached'
            }
          />
        </RevealItem>
      </RevealGroup>

      <div className="mt-10">
        <LeaderboardTabs
          boards={boards}
          meId={ctx.session.userId}
          optedIn={ctx.profile.leaderboardOptIn}
        />
      </div>

      <section className="mt-12">
        <Panel className="p-6 sm:p-8">
          <PanelHeader label="How points are earned" />
          <ul className="mt-6 divide-y divide-line">
            {FORGE_RULES.map((rule) => (
              <li key={rule.kind} className="flex items-center gap-5 py-4">
                <span className="im-mono w-14 shrink-0 text-[15px] font-extrabold text-green">
                  {rule.points > 0 ? `+${rule.points}` : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{rule.label}</span>
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
