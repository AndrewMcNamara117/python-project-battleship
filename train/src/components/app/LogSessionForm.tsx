'use client';

import { useState, useTransition } from 'react';
import { logWorkout, markSessionStatus, type Result } from '@/app/actions/training';
import { Button } from '@/components/ui/Button';
import { Field, Input, ScaleInput, Textarea } from '@/components/ui/Field';
import type { ScheduledWorkout, Units } from '@/lib/domain/types';

/**
 * Session logging. Designed to take about twenty seconds on a phone:
 * the two fields that matter are pre-filled from the prescription, and
 * everything else is optional.
 */
export function LogSessionForm({
  workout,
  units,
  logged,
}: {
  workout: ScheduledWorkout;
  units: Units;
  logged?: {
    actualDistanceKm: number | null;
    actualDurationMinutes: number | null;
    rpe: number | null;
    athleteNotes: string | null;
  } | null;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [rpe, setRpe] = useState(logged?.rpe ?? workout.rpeTarget ?? 5);
  const [soreness, setSoreness] = useState(3);
  const [rating, setRating] = useState(4);
  const [expanded, setExpanded] = useState(false);

  const done = workout.status === 'completed';

  return (
    <form
      id="log"
      noValidate
      action={(fd) => {
        fd.set('rpe', String(rpe));
        fd.set('soreness', String(soreness));
        fd.set('sessionRating', String(rating));
        start(async () => setResult(await logWorkout(fd)));
      }}
      className="space-y-7"
    >
      <input type="hidden" name="scheduledWorkoutId" value={workout.id} />

      <div className="flex items-baseline justify-between gap-4">
        <p className="im-micro">{done ? 'Update your log' : 'Log this session'}</p>
        {done && <span className="im-micro text-mint">Completed</span>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label={`Distance (${units === 'metric' ? 'km' : 'mi'})`}
          error={result?.fieldErrors?.actualDistanceKm}
        >
          {(p) => (
            <Input
              name="actualDistanceKm"
              type="number"
              step="0.1"
              min={0}
              inputMode="decimal"
              defaultValue={logged?.actualDistanceKm ?? workout.distanceKm ?? ''}
              {...p}
            />
          )}
        </Field>
        <Field label="Duration (minutes)" error={result?.fieldErrors?.actualDurationMinutes}>
          {(p) => (
            <Input
              name="actualDurationMinutes"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={logged?.actualDurationMinutes ?? workout.durationMinutes ?? ''}
              {...p}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
          How hard did it feel?
        </p>
        <div className="mt-3">
          <ScaleInput
            value={rpe}
            onChange={setRpe}
            lowLabel="Easy"
            highLabel="Maximal"
            ariaLabel="Rate of perceived exertion"
          />
        </div>
        {workout.rpeTarget != null && (
          <p className="mt-2.5 text-[12px] text-ink-tertiary">Prescribed RPE was {workout.rpeTarget}.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
      >
        {expanded ? 'Fewer details' : 'Add heart rate, soreness and notes'}
      </button>

      {expanded && (
        <div className="space-y-7 border-t border-hairline pt-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Average HR" error={result?.fieldErrors?.averageHeartRate}>
              {(p) => <Input name="averageHeartRate" type="number" min={30} max={240} inputMode="numeric" {...p} />}
            </Field>
            <Field label="Max HR" error={result?.fieldErrors?.maxHeartRate}>
              {(p) => <Input name="maxHeartRate" type="number" min={30} max={250} inputMode="numeric" {...p} />}
            </Field>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-secondary">Soreness after</p>
            <div className="mt-3">
              <ScaleInput
                value={soreness}
                onChange={setSoreness}
                lowLabel="None"
                highLabel="Severe"
                ariaLabel="Soreness after the session"
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-secondary">Session rating</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className={`h-11 flex-1 rounded-xs border text-[12px] font-bold transition-colors ${
                    rating === n
                      ? 'border-mint bg-mint text-mint-deep'
                      : 'border-hairline-strong text-ink-secondary hover:text-ink-body'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
              1 = fell apart · 5 = felt unstoppable
            </p>
          </div>

          <Field label="Notes" hint="Anything your coach should know about how it went.">
            {(p) => (
              <Textarea name="athleteNotes" rows={3} defaultValue={logged?.athleteNotes ?? ''} {...p} />
            )}
          </Field>
        </div>
      )}

      {result && (
        <p
          role="status"
          className={`text-[13px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}
        >
          {result.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : done ? 'Update log' : 'Mark complete'}
        </Button>
        {!done && <MarkMissedButton workoutId={workout.id} />}
      </div>
    </form>
  );
}

function MarkMissedButton({ workoutId }: { workoutId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="quiet"
      disabled={pending}
      onClick={() => start(() => void markSessionStatus(workoutId, 'missed'))}
    >
      {pending ? '…' : 'Did not happen'}
    </Button>
  );
}
