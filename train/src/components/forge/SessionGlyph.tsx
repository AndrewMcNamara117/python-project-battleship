import type { WorkoutType } from '@/lib/domain/types';

/**
 * SESSION GLYPH — what kind of work this is, at 14px.
 *
 * The calendar's problem is that colour-coding eight session types produces a
 * chart of confetti. So type is carried by a mark and status is carried by
 * treatment: a filled mark is done, a hollow mark is scheduled, a struck mark
 * is missed. Colour is reserved for the one thing that needs attention.
 *
 * Every glyph sits on the same 16-unit grid so a week of them reads as a row of
 * instrument marks rather than a set of icons.
 */
const PATHS: Record<string, string> = {
  // running: a stride, rising left to right
  run: 'M2 12.5 L5.5 12.5 L8 4 L10.5 12.5 L14 12.5',
  // long run: the same stride, extended
  long: 'M1.5 12 L4 12 L6 5.5 L8 12 L10 6.5 L12 12 L14.5 12',
  // intervals: repeated peaks
  intervals: 'M2 12 L4 5 L6 12 L8 5 L10 12 L12 5 L14 12',
  // threshold / tempo: a sustained plateau
  threshold: 'M2 12 L5 6 L11 6 L14 12',
  // hills: a climb
  hills: 'M2 13 L6 13 L10 4 L14 4',
  // strength: a bar
  strength: 'M2 8 L14 8 M4 5 L4 11 M12 5 L12 11',
  // recovery / mobility: a shallow wave
  recovery: 'M2 8 C4.5 4.5 6 11.5 8 8 C10 4.5 11.5 11.5 14 8',
  // rest: a single rule
  rest: 'M3 8 L13 8',
  // race: a flag
  race: 'M4 14 L4 2 L12 4.5 L4 7',
  // cross-training / bike / swim: a circuit
  cross: 'M8 2.5 A5.5 5.5 0 1 1 7.99 2.5 M8 5.5 L8 8 L10 9.5',
};

function glyphFor(type: WorkoutType): { d: string; closed: boolean } {
  switch (type) {
    case 'long_run':
      return { d: PATHS.long, closed: false };
    case 'intervals':
      return { d: PATHS.intervals, closed: false };
    case 'threshold':
    case 'tempo':
    case 'race_pace':
    case 'progression_run':
      return { d: PATHS.threshold, closed: false };
    case 'hills':
      return { d: PATHS.hills, closed: false };
    case 'strength':
      return { d: PATHS.strength, closed: false };
    case 'recovery_run':
    case 'mobility':
      return { d: PATHS.recovery, closed: false };
    case 'rest':
      return { d: PATHS.rest, closed: false };
    case 'race':
      return { d: PATHS.race, closed: true };
    case 'bike':
    case 'swim':
    case 'cross_training':
    case 'brick':
      return { d: PATHS.cross, closed: false };
    default:
      return { d: PATHS.run, closed: false };
  }
}

export function SessionGlyph({
  type,
  status = 'scheduled',
  size = 16,
  className,
}: {
  type: WorkoutType;
  status?: 'scheduled' | 'completed' | 'missed' | 'rescheduled' | 'skipped';
  size?: number;
  className?: string;
}) {
  const { d, closed } = glyphFor(type);

  const stroke =
    status === 'completed'
      ? 'var(--color-mint)'
      : status === 'missed'
        ? 'var(--color-status-missed)'
        : type === 'rest'
          ? 'var(--color-ink-faint)'
          : 'var(--color-ink-secondary)';

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={closed && status === 'completed' ? stroke : 'none'}
      stroke={stroke}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      style={status === 'missed' ? { opacity: 0.75 } : undefined}
    >
      <path d={d} />
      {status === 'missed' && <path d="M2.5 13.5 L13.5 2.5" strokeWidth="1.1" />}
    </svg>
  );
}
