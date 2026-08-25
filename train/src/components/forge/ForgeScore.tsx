import Link from 'next/link';
import { CountUp } from '@/components/motion/CountUp';
import { Panel } from '@/components/ui/Panel';
import { ProgressRing } from './ProgressRing';
import type { tierFor } from '@/lib/domain/forge-score';

/**
 * FORGE SCORE — accumulated consistency, not accumulated mileage.
 *
 * Presented as a tier climb rather than a total, because the total alone says
 * nothing an athlete can act on. The ring is progress toward the next tier;
 * the figure is the score. Deliberately not a badge, a level-up or a trophy —
 * this is a training record, not a game.
 */
export function ForgeScore({
  total,
  tier,
  streakWeeks,
  href = '/app/leaderboard',
}: {
  total: number;
  tier: ReturnType<typeof tierFor>;
  streakWeeks: number;
  href?: string;
}) {
  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="im-micro">Forge Score</p>
        <p className="im-micro">
          Tier <span className="text-mint">{tier.name}</span>
        </p>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <ProgressRing
          value={tier.progress}
          size={82}
          label={`Progress to ${tier.next ?? 'top tier'}`}
        >
          <span className="im-figure block text-[1.15rem] text-ink">
            <CountUp to={total} />
          </span>
          <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
            points
          </span>
        </ProgressRing>

        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            {tier.next ? (
              <>
                <span className="im-mono font-bold text-ink-body">{tier.pointsToNext}</span> to{' '}
                {tier.next}
              </>
            ) : (
              'Top tier reached'
            )}
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
            <span className="im-mono font-bold text-ink-body">{streakWeeks}</span>{' '}
            {streakWeeks === 1 ? 'week' : 'weeks'} unbroken
          </p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-auto border-t border-hairline pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
        style={{ marginTop: 'auto', paddingTop: '1rem' }}
      >
        Leaderboard
      </Link>
    </Panel>
  );
}
