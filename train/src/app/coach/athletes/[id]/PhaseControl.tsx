'use client';

import { useState, useTransition } from 'react';
import { setAthleteCoachingContext, type Result } from '@/app/actions/coach';
import {
  EXPERIENCE_LABELS,
  PHASE_LABELS,
  type ExperienceLevel,
  type TrainingPhase,
} from '@/lib/domain/types';

const PHASES = Object.keys(PHASE_LABELS) as TrainingPhase[];
const LEVELS = Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[];

/**
 * The two fields the coach owns on an athlete's profile.
 *
 * Availability and injury notes are deliberately absent: those belong to the
 * athlete. A coach reclassifying someone's experience is a coaching call; a
 * coach editing what an athlete said about their calf is not.
 */
export function CoachingContextControl({
  athleteId,
  phase,
  experience,
}: {
  athleteId: string;
  phase: TrainingPhase | null;
  experience: ExperienceLevel | null;
}) {
  const [current, setCurrent] = useState({ phase, experience });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  function save(patch: { trainingPhase?: TrainingPhase | null; experienceLevel?: ExperienceLevel | null }) {
    const next = {
      phase: patch.trainingPhase !== undefined ? patch.trainingPhase : current.phase,
      experience: patch.experienceLevel !== undefined ? patch.experienceLevel : current.experience,
    };
    setCurrent(next);
    start(async () => setResult(await setAthleteCoachingContext(athleteId, patch)));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <label className="flex items-center gap-2.5">
        <span className="im-micro">Phase</span>
        <select
          value={current.phase ?? ''}
          disabled={pending}
          onChange={(e) => save({ trainingPhase: (e.target.value || null) as TrainingPhase | null })}
          className="rounded-xs border border-hairline-strong bg-slate px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-body focus:border-mint focus:outline-none"
        >
          <option value="">Not set</option>
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {PHASE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2.5">
        <span className="im-micro">Level</span>
        <select
          value={current.experience ?? ''}
          disabled={pending}
          onChange={(e) => save({ experienceLevel: (e.target.value || null) as ExperienceLevel | null })}
          className="rounded-xs border border-hairline-strong bg-slate px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-body focus:border-mint focus:outline-none"
        >
          <option value="">Not set</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {EXPERIENCE_LABELS[l]}
            </option>
          ))}
        </select>
      </label>

      {result && (
        <span role="status" className={`text-[11px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}>
          {result.ok ? 'Saved' : result.message}
        </span>
      )}
    </div>
  );
}
