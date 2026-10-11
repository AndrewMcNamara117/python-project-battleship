import type { ReactNode } from 'react';
import type { SessionStatus } from '@/lib/domain/types';

/**
 * STATUS TAG — the five states of a training session.
 *
 * Semantic colour, deliberately separate from the Iron Miles accent. Every
 * value clears WCAG AA on Onyx, Charcoal and Slate, and status is never carried
 * by colour alone: the tag always states the status in words.
 */

const TONES = {
  completed: 'border-status-completed/35 text-status-completed bg-status-completed/8',
  scheduled: 'border-status-scheduled/30 text-status-scheduled bg-status-scheduled/8',
  progress: 'border-status-progress/35 text-status-progress bg-status-progress/8',
  missed: 'border-status-missed/35 text-status-missed bg-status-missed/8',
  low: 'border-status-low/35 text-status-low bg-status-low/8',
  neutral: 'border-hairline-strong text-ink-secondary bg-white/3',
  solid: 'border-transparent bg-mint text-mint-deep',
} as const;

export type StatusTone = keyof typeof TONES;

export function StatusTag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-xs border px-2 py-1',
        'text-[9px] font-bold uppercase leading-none tracking-[0.16em] whitespace-nowrap',
        TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

/** The mapping from a scheduled session's state to its tag. One place, not many. */
export function sessionTone(status: SessionStatus): StatusTone {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'missed':
      return 'missed';
    case 'rescheduled':
      return 'progress';
    case 'skipped':
      return 'neutral';
    default:
      return 'scheduled';
  }
}

export function sessionLabel(status: SessionStatus): string {
  return {
    scheduled: 'Scheduled',
    completed: 'Completed',
    missed: 'Missed',
    rescheduled: 'Moved',
    skipped: 'Skipped',
  }[status];
}

/** Adherence has its own scale — the coach reads this, not a raw number. */
export function adherenceTone(pct: number): StatusTone {
  if (pct >= 90) return 'completed';
  if (pct >= 70) return 'neutral';
  if (pct >= 50) return 'low';
  return 'missed';
}
