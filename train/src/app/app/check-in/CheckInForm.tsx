'use client';

import { useState, useTransition } from 'react';
import { submitCheckIn, type Result } from '@/app/actions/training';
import { Button } from '@/components/ui/Button';
import { Field, ScaleInput, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { CHECKIN_SCALES } from '@/lib/domain/checkin-rules';
import type { CheckInScores } from '@/lib/domain/types';

const QUESTIONS = [
  { name: 'wentWell', label: 'What went well?', placeholder: 'The session you were proudest of, or the one you nearly skipped and did anyway.' },
  { name: 'feltDifficult', label: 'What felt difficult?', placeholder: 'Physically or otherwise.' },
  {
    name: 'painOrNiggles',
    label: 'Any pain or niggles?',
    placeholder: 'Where, when it shows up, and whether it is getting better or worse.',
    hint: 'Be specific. This is the single most useful box on the page.',
  },
  { name: 'affectingTraining', label: 'Anything affecting training this week?', placeholder: 'Work, sleep, travel, illness, life.' },
  { name: 'confidenceNextWeek', label: 'How confident do you feel about next week?', placeholder: '' },
  { name: 'forCoach', label: 'Anything you want your coach to know?', placeholder: '' },
] as const;

const DEFAULTS: CheckInScores = {
  fatigue: 5,
  sleep: 6,
  soreness: 4,
  stress: 4,
  motivation: 7,
  confidence: 7,
  trainingDifficulty: 6,
};

export function CheckInForm({
  weekStart,
  existing,
}: {
  weekStart: string;
  existing: { scores: CheckInScores } | null;
}) {
  const [scores, setScores] = useState<CheckInScores>(existing?.scores ?? DEFAULTS);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) {
    const urgent = result.message.includes('doctor');
    return (
      <Panel className={`p-8 sm:p-10 ${urgent ? 'border-alert/45 bg-alert/6' : ''}`} edge={!urgent}>
        <p className={`im-eyebrow ${urgent ? 'text-alert' : ''}`}>
          {urgent ? 'Please read this' : 'Submitted'}
        </p>
        <p className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-white">{result.message}</p>
      </Panel>
    );
  }

  return (
    <form
      noValidate
      action={(fd) => {
        fd.set('weekStart', weekStart);
        for (const [k, v] of Object.entries(scores)) fd.set(k, String(v));
        start(async () => setResult(await submitCheckIn(fd)));
      }}
      className="space-y-6"
    >
      <Panel className="p-7 sm:p-9">
        <p className="im-micro">Rate the week</p>
        <p className="mt-2.5 text-[13px] text-muted">
          Answer honestly rather than well. An 8 for soreness is more useful to your coach than a 4
          you wish were true.
        </p>

        <div className="mt-8 space-y-8">
          {CHECKIN_SCALES.map((scale) => (
            <div key={scale.key}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px] font-bold uppercase tracking-[0.1em]">{scale.label}</p>
                <p className="im-mono text-[13px] font-bold text-green">{scores[scale.key]}/10</p>
              </div>
              <div className="mt-3">
                <ScaleInput
                  value={scores[scale.key]}
                  onChange={(v) => setScores((s) => ({ ...s, [scale.key]: v }))}
                  lowLabel={scale.low}
                  highLabel={scale.high}
                  ariaLabel={scale.label}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-7 sm:p-9">
        <p className="im-micro">In your own words</p>
        <div className="mt-8 space-y-7">
          {QUESTIONS.map((q) => (
            <Field key={q.name} label={q.label} hint={'hint' in q ? q.hint : undefined}>
              {(p) => <Textarea name={q.name} rows={3} placeholder={q.placeholder} {...p} />}
            </Field>
          ))}
        </div>
      </Panel>

      {result && !result.ok && (
        <p role="alert" className="text-[13px] font-bold text-alert">
          {result.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Sending…' : existing ? 'Update check-in' : 'Submit check-in'}
        </Button>
        <p className="max-w-[42ch] text-[11px] leading-relaxed text-muted-2">
          Visible to you and your coach only. Never shown on the leaderboard or to other athletes.
        </p>
      </div>
    </form>
  );
}
