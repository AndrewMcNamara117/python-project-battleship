import type { AttentionLevel, CheckIn, CheckInScores } from './types';

/**
 * Rule-based triage for weekly check-ins.
 *
 * This is a routing tool, not a clinical one. It decides whether a human coach
 * should look at a check-in sooner rather than later. It does not diagnose,
 * grade or name any condition, and its output is always phrased as a
 * recommendation to a coach — never as a finding about the athlete.
 */

export const CHECKIN_SCALES = [
  { key: 'fatigue', label: 'Fatigue', low: 'Fresh', high: 'Exhausted', inverted: true },
  { key: 'sleep', label: 'Sleep', low: 'Poor', high: 'Excellent', inverted: false },
  { key: 'soreness', label: 'Soreness', low: 'None', high: 'Severe', inverted: true },
  { key: 'stress', label: 'Life stress', low: 'Calm', high: 'Overloaded', inverted: true },
  { key: 'motivation', label: 'Motivation', low: 'Flat', high: 'Driven', inverted: false },
  { key: 'confidence', label: 'Confidence', low: 'Shaky', high: 'Certain', inverted: false },
  { key: 'trainingDifficulty', label: 'Training felt', low: 'Comfortable', high: 'Brutal', inverted: true },
] as const satisfies readonly { key: keyof CheckInScores; label: string; low: string; high: string; inverted: boolean }[];

/**
 * Words that mean "stop and get this looked at" rather than "this was a hard week".
 * Matched conservatively — a false positive costs a coach thirty seconds.
 */
const URGENT_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bchest (pain|tightness)\b|\bheart (pain|racing)\b/i, reason: 'Chest or cardiac symptoms mentioned' },
  { re: /\bdizz(y|iness)\b|\bfaint(ed|ing)?\b|\bblack(ed)? out\b/i, reason: 'Dizziness or fainting mentioned' },
  { re: /\bnumb(ness)?\b|\btingl(e|ing)\b|\bpins and needles\b/i, reason: 'Neurological symptoms mentioned' },
  { re: /\bsharp pain\b|\bstabbing\b|\bcan'?t (walk|weight ?bear)\b/i, reason: 'Sharp pain mentioned' },
  { re: /\bworsening\b|\bgetting worse\b|\bswollen\b|\bswelling\b/i, reason: 'Worsening or swelling mentioned' },
  { re: /\bstress fracture\b|\bfractur/i, reason: 'Possible bone injury mentioned' },
];

const PAIN_PATTERNS = /\bpain\b|\bniggle\b|\bsore(ness)?\b|\bstrain\b|\btight(ness)?\b|\binjur/i;

export interface TriageInput {
  scores: CheckInScores;
  freeText: string[];
  /** Sessions completed vs prescribed over the week being reviewed. */
  sessionsCompleted: number;
  sessionsPrescribed: number;
  /** Previous check-ins, most recent first, for trend rules. */
  history: Pick<CheckIn, 'scores'>[];
}

export interface TriageResult {
  level: AttentionLevel;
  reasons: string[];
  /** Shown to the athlete only when urgent — otherwise this routes silently to the coach. */
  athleteGuidance: string | null;
}

export function triageCheckIn(input: TriageInput): TriageResult {
  const { scores, freeText, sessionsCompleted, sessionsPrescribed, history } = input;
  const text = freeText.join(' \n ');
  const reasons: string[] = [];
  // a pattern across weeks is worth more than one bad reading, so these
  // escalate on their own rather than needing a second reason alongside them
  const strong: string[] = [];
  let urgent = false;

  for (const { re, reason } of URGENT_PATTERNS) {
    if (re.test(text)) {
      reasons.push(reason);
      urgent = true;
    }
  }

  if (!urgent && PAIN_PATTERNS.test(text)) reasons.push('Pain or niggle described in free text');

  if (scores.soreness >= 8) reasons.push('Soreness reported at 8 or above');
  if (scores.fatigue >= 8) reasons.push('Fatigue reported at 8 or above');
  if (scores.sleep <= 3) reasons.push('Sleep reported at 3 or below');
  if (scores.motivation <= 3) reasons.push('Motivation reported at 3 or below');
  if (scores.stress >= 8) reasons.push('Life stress reported at 8 or above');
  if (scores.confidence <= 3) reasons.push('Low confidence in the current block');

  // trend rules — two weeks running matters more than one bad week
  const prev = history[0]?.scores;
  if (prev) {
    if (scores.soreness >= 7 && prev.soreness >= 7) strong.push('High soreness two weeks running');
    if (scores.motivation <= 4 && prev.motivation <= 4) strong.push('Low motivation two weeks running');
    if (scores.sleep <= 4 && prev.sleep <= 4) strong.push('Poor sleep two weeks running');
    if (scores.fatigue - prev.fatigue >= 3) strong.push('Sharp week-on-week rise in fatigue');
  }

  if (sessionsPrescribed > 0) {
    const missed = sessionsPrescribed - sessionsCompleted;
    const adherence = sessionsCompleted / sessionsPrescribed;
    if (missed >= 3) strong.push(`${missed} prescribed sessions missed this week`);
    else if (adherence < 0.6) reasons.push('Weekly adherence below 60%');
  }

  // de-duplicate while keeping the strongest signals first
  const allReasons = [...new Set([...strong, ...reasons])];

  const level: AttentionLevel = urgent
    ? 'attention'
    : strong.length > 0
      ? 'attention'
      : reasons.length >= 2
        ? 'attention'
        : reasons.length === 1
          ? 'watch'
          : 'none';

  return {
    level,
    reasons: allReasons,
    athleteGuidance: urgent
      ? 'Some of what you have described is worth having looked at properly. Stop training and speak to a doctor or physiotherapist before your next session. Your coach has been notified. Iron Miles is not a medical service and this is not a diagnosis.'
      : null,
  };
}

export function attentionLabel(level: AttentionLevel): string {
  return level === 'attention' ? 'Coach attention recommended' : level === 'watch' ? 'Worth a look' : 'Nothing flagged';
}
