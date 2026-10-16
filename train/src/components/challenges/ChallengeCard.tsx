import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/Panel';
import { challengeState, formatAmount, METRICS, type Challenge, type ChallengeSummary } from '@/lib/domain/challenges';
import { daysBetween, formatDayMonth } from '@/lib/domain/dates';

/**
 * One challenge: what it asks, how long is left, the viewer's own progress
 * if they joined, and who has finished. No ranking — finished is finished.
 */
export function ChallengeCard({
  challenge: c,
  summary,
  today,
  action,
}: {
  challenge: Challenge;
  summary: ChallengeSummary;
  today: string;
  action?: ReactNode;
}) {
  const state = challengeState(c, today);
  const progress = summary.viewerProgress;
  const share = progress == null ? 0 : Math.min(1, progress / c.target);
  const done = progress != null && progress >= c.target;
  const left = daysBetween(today, c.endsOn);

  return (
    <Panel className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="im-micro">
            {METRICS[c.metric].label} ·{' '}
            <span className="whitespace-nowrap">
            {state === 'closed'
              ? 'Closed'
              : state === 'upcoming'
                ? `Starts ${formatDayMonth(c.startsOn)}`
                : left === 0
                  ? 'Last day'
                  : `${left} days left`}
            </span>
          </p>
          <h2 className="mt-2 text-[17px] font-bold text-ink">{c.name}</h2>
        </div>
        {action}
      </div>
      {c.description && <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{c.description}</p>}

      <p className="mt-4 text-[12px] text-ink-tertiary">
        Target {formatAmount(c.metric, c.target)} · {formatDayMonth(c.startsOn)}–{formatDayMonth(c.endsOn)}
      </p>

      {summary.viewerJoined && progress != null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className={`font-bold tabular-nums ${done ? 'text-mint' : 'text-ink'}`}>
              {formatAmount(c.metric, progress).replace(/ .*$/, '')} of {formatAmount(c.metric, c.target)}
            </span>
            {done && <span className="im-micro text-mint">Finished</span>}
          </div>
          <div
            className="mt-2 h-1.5 w-full bg-steel/60"
            role="progressbar"
            aria-label={`${c.name}: your progress`}
            aria-valuemin={0}
            aria-valuemax={c.target}
            aria-valuenow={Math.min(progress, c.target)}
            aria-valuetext={`${formatAmount(c.metric, progress)} of ${formatAmount(c.metric, c.target)}`}
          >
            <div className="h-1.5 origin-left bg-mint transition-transform duration-700" style={{ transform: `scaleX(${share.toFixed(3)})` }} />
          </div>
        </div>
      )}

      <div className="mt-auto pt-5 text-[12px] leading-relaxed text-ink-secondary">
        {summary.participants} {summary.participants === 1 ? 'member' : 'members'} in
        {summary.finishers.length > 0 && (
          <>
            {' '}
            · finished: <span className="text-ink-body">{summary.finishers.join(', ')}</span>
          </>
        )}
      </div>
    </Panel>
  );
}
