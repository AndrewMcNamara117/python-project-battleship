'use client';

import { useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { completeOnboarding, saveOnboardingStep } from '@/app/actions/onboarding';
import { IronMilesMark } from '@/components/brand/IronMilesLogo';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Segmented, Select, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { onboardingStepSchemas } from '@/lib/validation/schemas';
import { EVENT_TYPE_LABELS, type OnboardingData } from '@/lib/domain/types';
import { WEEKDAY_FULL } from '@/lib/domain/dates';

const STEPS = [
  { key: 'personal', title: 'You', blurb: 'The basics, so the plan speaks your language.' },
  { key: 'goal', title: 'The goal', blurb: 'One start line. Everything is built backwards from it.' },
  { key: 'history', title: 'History', blurb: 'Where you are now, honestly.' },
  { key: 'availability', title: 'Your week', blurb: 'The week you have, not the one you would like.' },
  { key: 'health', title: 'Health', blurb: 'The part that keeps this safe.' },
  { key: 'preferences', title: 'Coaching', blurb: 'How you want to be coached.' },
  { key: 'review', title: 'Review', blurb: 'One last look before it goes to your coach.' },
] as const;

const EQUIPMENT = [
  'Barbell',
  'Dumbbells',
  'Kettlebells',
  'Pull-up bar',
  'Bench',
  'Resistance bands',
  'Box or step',
  'Treadmill',
  'Turbo trainer',
];

const PARQ = [
  'A doctor has said I have a heart condition',
  'I get chest pain during physical activity',
  'I lose balance from dizziness or have lost consciousness',
  'I have a bone or joint problem made worse by activity',
  'I take medication for blood pressure or a heart condition',
  'I know of another reason I should not do physical activity',
];

const emptyData: OnboardingData = {
  personal: {
    fullName: '',
    dateOfBirth: '',
    location: '',
    timezone: 'Europe/Dublin',
    units: 'metric',
  },
  goal: { raceName: '', raceDate: '', eventType: 'half_marathon', outcome: 'completion', targetTime: '', why: '' },
  history: {
    weeklyKm: 0,
    sessionsPerWeek: 3,
    longestRecentKm: 0,
    personalBests: '',
    enduranceBackground: '',
    strengthBackground: '',
  },
  availability: {
    trainingDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
    longRunDay: 'Sunday',
    typicalSessionMinutes: 60,
    gymAccess: 'full_gym',
    equipment: [],
  },
  health: {
    currentInjuries: '',
    recentInjuries: '',
    parqFlags: [],
    medicalClearance: false,
    acknowledgedDisclaimer: false,
  },
  preferences: {
    feedbackStyle: 'direct',
    motivationStyle: 'process',
    messagingPreference: 'in_app',
    checkInFrequency: 'weekly',
    forgeAssistantEnabled: true,
    leaderboardOptIn: false,
  },
};

type Errors = Record<string, string>;

export function OnboardingWizard({ initial, startStep }: { initial: Partial<OnboardingData>; startStep: number }) {
  const [step, setStep] = useState(Math.min(Math.max(startStep, 1), STEPS.length));
  const [data, setData] = useState<OnboardingData>({ ...emptyData, ...initial } as OnboardingData);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reduced = useReducedMotion();

  const current = STEPS[step - 1];

  function patch<K extends keyof OnboardingData>(key: K, value: Partial<OnboardingData[K]>) {
    setData((d) => ({ ...d, [key]: { ...d[key], ...value } }));
  }

  function validateCurrent(): boolean {
    if (current.key === 'review') return true;
    const schema = onboardingStepSchemas[current.key];
    const result = schema.safeParse(data[current.key]);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Errors = {};
    for (const issue of result.error.issues) {
      const k = String(issue.path[0] ?? 'form');
      if (!next[k]) next[k] = issue.message;
    }
    setErrors(next);
    return false;
  }

  function next() {
    if (!validateCurrent()) return;
    setFormError(null);
    const target = Math.min(step + 1, STEPS.length);
    start(async () => {
      await saveOnboardingStep(target, data);
      setStep(target);
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function submit() {
    start(async () => {
      const result = await completeOnboarding(data);
      if (result && !result.ok) setFormError(result.message ?? 'Something is missing.');
    });
  }

  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="mx-auto max-w-[860px] px-5 py-[clamp(40px,6vw,72px)]">
      {/* ---- progress ---- */}
      <div className="flex items-center gap-3">
        <IronMilesMark height={24} title="Iron Miles" />
        <span className="im-micro">Onboarding</span>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <p className="im-eyebrow">
            Step {step} of {STEPS.length}
          </p>
          <p className="im-mono text-[11px] tracking-[0.16em] text-muted-2">{pct}%</p>
        </div>

        <div className="mt-4 h-px w-full bg-line-2" role="presentation">
          <motion.div
            className="h-px bg-green"
            initial={false}
            animate={{ width: `${Math.max(pct, 3)}%` }}
            transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Onboarding steps">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              aria-current={i + 1 === step ? 'step' : undefined}
              className={`text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                i + 1 === step ? 'text-green' : i + 1 < step ? 'text-muted' : 'text-muted-2'
              }`}
            >
              {s.title}
            </li>
          ))}
        </ol>
      </div>

      <h1 className="im-display mt-10 text-[clamp(2rem,5vw,3rem)]">{current.title}</h1>
      <p className="mt-3 text-[15px] text-muted">{current.blurb}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.key}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Panel className="mt-10 p-7 sm:p-9">
            {current.key === 'personal' && (
              <div className="space-y-7">
                <Field label="Full name" required error={errors.fullName}>
                  {(p) => (
                    <Input
                      value={data.personal.fullName}
                      onChange={(e) => patch('personal', { fullName: e.target.value })}
                      autoComplete="name"
                      {...p}
                    />
                  )}
                </Field>
                <div className="grid gap-7 sm:grid-cols-2">
                  <Field
                    label="Date of birth"
                    required
                    hint="Used to set heart-rate zones sensibly. Nothing else."
                    error={errors.dateOfBirth}
                  >
                    {(p) => (
                      <Input
                        type="date"
                        value={data.personal.dateOfBirth}
                        onChange={(e) => patch('personal', { dateOfBirth: e.target.value })}
                        {...p}
                      />
                    )}
                  </Field>
                  <Field label="Where do you train?" required error={errors.location}>
                    {(p) => (
                      <Input
                        value={data.personal.location}
                        onChange={(e) => patch('personal', { location: e.target.value })}
                        placeholder="Limerick, Ireland"
                        {...p}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Timezone" required error={errors.timezone}>
                  {(p) => (
                    <Select
                      value={data.personal.timezone}
                      onChange={(e) => patch('personal', { timezone: e.target.value })}
                      {...p}
                    >
                      {['Europe/Dublin', 'Europe/London', 'Europe/Madrid', 'America/New_York', 'Australia/Sydney'].map(
                        (tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </option>
                        ),
                      )}
                    </Select>
                  )}
                </Field>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Units</p>
                  <Segmented
                    className="mt-2.5"
                    ariaLabel="Preferred units"
                    value={data.personal.units}
                    onChange={(v) => patch('personal', { units: v })}
                    options={[
                      { value: 'metric', label: 'Kilometres', hint: 'km · min/km' },
                      { value: 'imperial', label: 'Miles', hint: 'mi · min/mi' },
                    ]}
                  />
                </div>
              </div>
            )}

            {current.key === 'goal' && (
              <div className="space-y-7">
                <div className="grid gap-7 sm:grid-cols-2">
                  <Field label="Target race" hint="Leave blank if you have not picked one." error={errors.raceName}>
                    {(p) => (
                      <Input
                        value={data.goal.raceName}
                        onChange={(e) => patch('goal', { raceName: e.target.value })}
                        placeholder="Connemara Ultra"
                        {...p}
                      />
                    )}
                  </Field>
                  <Field label="Race date" required error={errors.raceDate}>
                    {(p) => (
                      <Input
                        type="date"
                        value={data.goal.raceDate}
                        onChange={(e) => patch('goal', { raceDate: e.target.value })}
                        {...p}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Event type" required error={errors.eventType}>
                  {(p) => (
                    <Select
                      value={data.goal.eventType}
                      onChange={(e) =>
                        patch('goal', { eventType: e.target.value as OnboardingData['goal']['eventType'] })
                      }
                      {...p}
                    >
                      {Object.entries(EVENT_TYPE_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">What counts as success?</p>
                  <Segmented
                    className="mt-2.5"
                    ariaLabel="Goal outcome"
                    value={data.goal.outcome}
                    onChange={(v) => patch('goal', { outcome: v })}
                    options={[
                      { value: 'completion', label: 'Finish it', hint: 'Get to the line ready' },
                      { value: 'time', label: 'A time', hint: 'A number in mind' },
                      { value: 'placing', label: 'A placing', hint: 'Racing the field' },
                      { value: 'process', label: 'The habit', hint: 'Consistency first' },
                    ]}
                  />
                </div>
                {data.goal.outcome === 'time' && (
                  <Field label="Target time" hint="Format: 3:45:00 or 45:00." error={errors.targetTime}>
                    {(p) => (
                      <Input
                        value={data.goal.targetTime}
                        onChange={(e) => patch('goal', { targetTime: e.target.value })}
                        placeholder="3:45:00"
                        {...p}
                      />
                    )}
                  </Field>
                )}
                <Field
                  label="Why this goal?"
                  required
                  hint="This is the part we read back to you in week fourteen when it stops being fun."
                  error={errors.why}
                >
                  {(p) => (
                    <Textarea
                      rows={4}
                      value={data.goal.why}
                      onChange={(e) => patch('goal', { why: e.target.value })}
                      {...p}
                    />
                  )}
                </Field>
              </div>
            )}

            {current.key === 'history' && (
              <div className="space-y-7">
                <div className="grid gap-7 sm:grid-cols-3">
                  <Field label="Weekly volume" hint="km / week" required error={errors.weeklyKm}>
                    {(p) => (
                      <Input
                        type="number"
                        min={0}
                        max={400}
                        value={data.history.weeklyKm}
                        onChange={(e) => patch('history', { weeklyKm: Number(e.target.value) })}
                        {...p}
                      />
                    )}
                  </Field>
                  <Field label="Sessions" hint="per week" required error={errors.sessionsPerWeek}>
                    {(p) => (
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={data.history.sessionsPerWeek}
                        onChange={(e) => patch('history', { sessionsPerWeek: Number(e.target.value) })}
                        {...p}
                      />
                    )}
                  </Field>
                  <Field label="Longest recent run" hint="km, last 8 weeks" required error={errors.longestRecentKm}>
                    {(p) => (
                      <Input
                        type="number"
                        min={0}
                        max={300}
                        value={data.history.longestRecentKm}
                        onChange={(e) => patch('history', { longestRecentKm: Number(e.target.value) })}
                        {...p}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Personal bests" hint="Any distances, any era. Approximate is fine." error={errors.personalBests}>
                  {(p) => (
                    <Textarea
                      rows={3}
                      value={data.history.personalBests}
                      onChange={(e) => patch('history', { personalBests: e.target.value })}
                      placeholder="5K 22:40 (2024) · Half 1:48 (2025) · Dublin Marathon 3:41 (2025)"
                      {...p}
                    />
                  )}
                </Field>
                <Field label="Endurance background" error={errors.enduranceBackground}>
                  {(p) => (
                    <Textarea
                      rows={3}
                      value={data.history.enduranceBackground}
                      onChange={(e) => patch('history', { enduranceBackground: e.target.value })}
                      placeholder="How long you have been running, and what shape the last year took."
                      {...p}
                    />
                  )}
                </Field>
                <Field label="Strength background" error={errors.strengthBackground}>
                  {(p) => (
                    <Textarea
                      rows={3}
                      value={data.history.strengthBackground}
                      onChange={(e) => patch('history', { strengthBackground: e.target.value })}
                      placeholder="Never lifted is a perfectly good answer."
                      {...p}
                    />
                  )}
                </Field>
              </div>
            )}

            {current.key === 'availability' && (
              <div className="space-y-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                    Days you can train
                  </p>
                  <p className="mt-1.5 text-[12px] text-muted-2">
                    Pick the days that are realistic every week, not the good weeks.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {WEEKDAY_FULL.map((day) => {
                      const on = data.availability.trainingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            patch('availability', {
                              trainingDays: on
                                ? data.availability.trainingDays.filter((d) => d !== day)
                                : [...data.availability.trainingDays, day],
                            })
                          }
                          className={`rounded-xs border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                            on ? 'border-green bg-green/10 text-white' : 'border-line-2 text-muted hover:text-white'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {errors.trainingDays && (
                    <p role="alert" className="mt-2 text-[12px] font-bold text-alert">
                      {errors.trainingDays}
                    </p>
                  )}
                </div>

                <div className="grid gap-7 sm:grid-cols-2">
                  <Field label="Long-run day" required error={errors.longRunDay}>
                    {(p) => (
                      <Select
                        value={data.availability.longRunDay}
                        onChange={(e) => patch('availability', { longRunDay: e.target.value })}
                        {...p}
                      >
                        {WEEKDAY_FULL.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Typical session length" hint="minutes" required error={errors.typicalSessionMinutes}>
                    {(p) => (
                      <Input
                        type="number"
                        min={15}
                        max={360}
                        step={5}
                        value={data.availability.typicalSessionMinutes}
                        onChange={(e) =>
                          patch('availability', { typicalSessionMinutes: Number(e.target.value) })
                        }
                        {...p}
                      />
                    )}
                  </Field>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Gym access</p>
                  <Segmented
                    className="mt-2.5"
                    ariaLabel="Gym access"
                    value={data.availability.gymAccess}
                    onChange={(v) => patch('availability', { gymAccess: v })}
                    options={[
                      { value: 'full_gym', label: 'Full gym' },
                      { value: 'home_gym', label: 'Home gym' },
                      { value: 'bodyweight', label: 'Bodyweight' },
                      { value: 'none', label: 'None' },
                    ]}
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Equipment available</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EQUIPMENT.map((item) => {
                      const on = data.availability.equipment.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            patch('availability', {
                              equipment: on
                                ? data.availability.equipment.filter((e) => e !== item)
                                : [...data.availability.equipment, item],
                            })
                          }
                          className={`rounded-xs border px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                            on ? 'border-green bg-green/10 text-white' : 'border-line-2 text-muted hover:text-white'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {current.key === 'health' && (
              <div className="space-y-7">
                <div className="border border-line-2 bg-iron-2 p-5">
                  <p className="im-micro text-green">Read this first</p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-white">
                    Iron Miles Training is a coaching service, not a medical one. Nothing here
                    diagnoses or treats anything. If you have a health condition, are returning from
                    injury, or are unsure whether you are fit to train, speak to a doctor before
                    starting.
                  </p>
                </div>

                <Field label="Current injuries or pain" hint="Anything that is bothering you right now." error={errors.currentInjuries}>
                  {(p) => (
                    <Textarea
                      rows={3}
                      value={data.health.currentInjuries}
                      onChange={(e) => patch('health', { currentInjuries: e.target.value })}
                      placeholder="Nothing right now is a good answer."
                      {...p}
                    />
                  )}
                </Field>
                <Field label="Injuries in the last two years" error={errors.recentInjuries}>
                  {(p) => (
                    <Textarea
                      rows={3}
                      value={data.health.recentInjuries}
                      onChange={(e) => patch('health', { recentInjuries: e.target.value })}
                      {...p}
                    />
                  )}
                </Field>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                    Screening — tick anything that applies
                  </p>
                  <p className="mt-1.5 text-[12px] text-muted-2">
                    A PAR-Q style screen. Ticking a box does not stop you training; it means your
                    coach will ask you to get clearance first.
                  </p>
                  <div className="mt-4 space-y-3">
                    {PARQ.map((q) => (
                      <Checkbox
                        key={q}
                        label={q}
                        checked={data.health.parqFlags.includes(q)}
                        onChange={(e) =>
                          patch('health', {
                            parqFlags: e.target.checked
                              ? [...data.health.parqFlags, q]
                              : data.health.parqFlags.filter((f) => f !== q),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>

                {data.health.parqFlags.length > 0 && (
                  <div className="border border-warn/35 bg-warn/8 p-5">
                    <p className="im-micro text-warn">Clearance needed</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white">
                      Because you ticked at least one box, your coach will ask for medical clearance
                      before writing your first block. That is normal and it does not mean no.
                    </p>
                  </div>
                )}

                <div className="space-y-4 border-t border-line pt-7">
                  <Checkbox
                    label="I have medical clearance to train, or nothing in the screen above applies to me."
                    checked={data.health.medicalClearance}
                    onChange={(e) => patch('health', { medicalClearance: e.target.checked })}
                  />
                  <div>
                    <Checkbox
                      label="I understand Iron Miles Training does not replace medical care."
                      description="If something hurts in a way that worries me, I will stop and see a doctor or physiotherapist rather than wait for a check-in."
                      checked={data.health.acknowledgedDisclaimer}
                      onChange={(e) => patch('health', { acknowledgedDisclaimer: e.target.checked })}
                    />
                    {errors.acknowledgedDisclaimer && (
                      <p role="alert" className="mt-2 text-[12px] font-bold text-alert">
                        {errors.acknowledgedDisclaimer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {current.key === 'preferences' && (
              <div className="space-y-8">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Feedback style</p>
                  <Segmented
                    className="mt-2.5"
                    ariaLabel="Feedback style"
                    value={data.preferences.feedbackStyle}
                    onChange={(v) => patch('preferences', { feedbackStyle: v })}
                    options={[
                      { value: 'direct', label: 'Direct', hint: 'Tell me straight' },
                      { value: 'encouraging', label: 'Encouraging', hint: 'Lead with what worked' },
                      { value: 'analytical', label: 'Analytical', hint: 'Show me the numbers' },
                    ]}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">What keeps you going</p>
                  <Segmented
                    className="mt-2.5"
                    ariaLabel="Motivation style"
                    value={data.preferences.motivationStyle}
                    onChange={(v) => patch('preferences', { motivationStyle: v })}
                    options={[
                      { value: 'data', label: 'Data', hint: 'Watching it move' },
                      { value: 'process', label: 'Process', hint: 'Ticking the box' },
                      { value: 'community', label: 'People', hint: 'Not going alone' },
                      { value: 'challenge', label: 'Challenge', hint: 'Something hard' },
                    ]}
                  />
                </div>
                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Messages</p>
                    <Segmented
                      className="mt-2.5"
                      ariaLabel="Messaging preference"
                      value={data.preferences.messagingPreference}
                      onChange={(v) => patch('preferences', { messagingPreference: v })}
                      options={[
                        { value: 'in_app', label: 'In app' },
                        { value: 'email', label: 'Email' },
                        { value: 'both', label: 'Both' },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Check-in every</p>
                    <Segmented
                      className="mt-2.5"
                      ariaLabel="Check-in frequency"
                      value={data.preferences.checkInFrequency}
                      onChange={(v) => patch('preferences', { checkInFrequency: v })}
                      options={[
                        { value: 'weekly', label: 'Week' },
                        { value: 'fortnightly', label: 'Fortnight' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-line pt-7">
                  <Checkbox
                    label="Enable FORGE, the daily training assistant."
                    description="Short contextual messages about today's session and your week. Your coach can switch it off at any time."
                    checked={data.preferences.forgeAssistantEnabled}
                    onChange={(e) => patch('preferences', { forgeAssistantEnabled: e.target.checked })}
                  />
                  <Checkbox
                    label="Show me on the Iron Miles leaderboard."
                    description="Off by default. Only your display name and Forge Score are ever visible — never your training or check-in data."
                    checked={data.preferences.leaderboardOptIn}
                    onChange={(e) => patch('preferences', { leaderboardOptIn: e.target.checked })}
                  />
                </div>
              </div>
            )}

            {current.key === 'review' && (
              <div className="space-y-8">
                <ReviewBlock title="You" onEdit={() => setStep(1)}>
                  {data.personal.fullName || '—'} · {data.personal.location || '—'} ·{' '}
                  {data.personal.units === 'metric' ? 'Kilometres' : 'Miles'}
                </ReviewBlock>
                <ReviewBlock title="The goal" onEdit={() => setStep(2)}>
                  {data.goal.raceName || EVENT_TYPE_LABELS[data.goal.eventType]}
                  {data.goal.raceDate ? ` · ${data.goal.raceDate}` : ''}
                  {data.goal.outcome === 'time' && data.goal.targetTime ? ` · target ${data.goal.targetTime}` : ''}
                </ReviewBlock>
                <ReviewBlock title="History" onEdit={() => setStep(3)}>
                  {data.history.weeklyKm} km/week · {data.history.sessionsPerWeek} sessions ·
                  longest {data.history.longestRecentKm} km
                </ReviewBlock>
                <ReviewBlock title="Your week" onEdit={() => setStep(4)}>
                  {data.availability.trainingDays.map((d) => d.slice(0, 3)).join(', ') || '—'} · long run{' '}
                  {data.availability.longRunDay} · {data.availability.typicalSessionMinutes} min
                </ReviewBlock>
                <ReviewBlock title="Health" onEdit={() => setStep(5)}>
                  {data.health.parqFlags.length
                    ? `${data.health.parqFlags.length} screening item(s) flagged — clearance required`
                    : 'Nothing flagged in screening'}
                </ReviewBlock>
                <ReviewBlock title="Coaching" onEdit={() => setStep(6)}>
                  {data.preferences.feedbackStyle} feedback · {data.preferences.checkInFrequency} check-ins ·
                  FORGE {data.preferences.forgeAssistantEnabled ? 'on' : 'off'} · leaderboard{' '}
                  {data.preferences.leaderboardOptIn ? 'on' : 'off'}
                </ReviewBlock>

                <p className="border-t border-line pt-6 text-[13px] leading-relaxed text-muted">
                  Submitting sends this to your coach and unlocks the training hub. Everything here
                  stays editable from your profile.
                </p>
              </div>
            )}
          </Panel>
        </motion.div>
      </AnimatePresence>

      {formError && (
        <p role="alert" className="mt-6 text-[13px] font-bold text-alert">
          {formError}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button variant="quiet" onClick={back} disabled={step === 1 || pending}>
          Back
        </Button>
        {step < STEPS.length ? (
          <Button size="lg" onClick={next} disabled={pending}>
            {pending ? 'Saving…' : 'Continue'}
          </Button>
        ) : (
          <Button size="lg" onClick={submit} disabled={pending}>
            {pending ? 'Submitting…' : 'Finish onboarding'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line pb-6">
      <div>
        <p className="im-micro">{title}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-white">{children}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-green"
      >
        Edit
      </button>
    </div>
  );
}
