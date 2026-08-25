'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { saveStrengthProgress } from '@/app/actions/training';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, ScaleInput, Textarea } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatDuration } from '@/lib/domain/dates';
import type { StrengthExercise, StrengthSetLog, StrengthTemplate } from '@/lib/domain/types';

interface SetKey {
  exerciseId: string;
  setIndex: number;
}

/**
 * Strength session player.
 *
 * One exercise on screen at a time, sets ticked as they are done, a rest timer
 * that starts itself, and RPE captured per set. Progress is saved to the server
 * as sets complete, so closing the app mid-session loses nothing.
 */
export function SessionPlayer({
  template,
  exercises,
  scheduledWorkoutId,
  date,
  initialLogs,
  initialComplete,
}: {
  template: StrengthTemplate;
  exercises: StrengthExercise[];
  scheduledWorkoutId: string | null;
  date: string;
  initialLogs: StrengthSetLog[];
  initialComplete: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [logs, setLogs] = useState<StrengthSetLog[]>(initialLogs);
  const [complete, setComplete] = useState(initialComplete);
  const [notes, setNotes] = useState('');
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [, start] = useTransition();
  const reduced = useReducedMotion();
  // set on the first interaction rather than during render — Date.now() in a
  // render body is impure and would differ between server and client
  const startedAt = useRef<number | null>(null);

  const block = template.blocks[index];
  const exercise = exercises.find((e) => e.id === block?.exerciseId);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const totalSets = template.blocks.reduce((a, b) => a + b.sets, 0);
  const doneSets = logs.filter((l) => l.completed).length;

  /* rest timer — ticks down and stops at zero; zero renders as "go" */
  useEffect(() => {
    if (restLeft == null || restLeft <= 0) return;
    const id = setTimeout(() => setRestLeft((t) => (t == null ? null : Math.max(0, t - 1))), 1000);
    return () => clearTimeout(id);
  }, [restLeft]);

  function logAt({ exerciseId, setIndex }: SetKey) {
    return logs.find((l) => l.exerciseId === exerciseId && l.setIndex === setIndex);
  }

  function persist(nextLogs: StrengthSetLog[], done: boolean) {
    start(async () => {
      startedAt.current ??= Date.now();
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
      const result = await saveStrengthProgress(
        scheduledWorkoutId,
        template.id,
        date,
        nextLogs,
        done,
        done ? minutes : null,
        notes || null,
      );
      setStatus(result.message);
    });
  }

  function toggleSet(key: SetKey, rpe: number | null) {
    startedAt.current ??= Date.now();
    const existing = logAt(key);
    const next = existing
      ? logs.map((l) =>
          l.exerciseId === key.exerciseId && l.setIndex === key.setIndex
            ? { ...l, completed: !l.completed, rpe: rpe ?? l.rpe }
            : l,
        )
      : [...logs, { ...key, reps: null, weightKg: null, rpe, completed: true }];

    setLogs(next);
    persist(next, false);

    // start the rest clock when a set is ticked on, not off
    const nowComplete = next.find((l) => l.exerciseId === key.exerciseId && l.setIndex === key.setIndex)?.completed;
    if (nowComplete && block?.restSeconds) setRestLeft(block.restSeconds);
  }

  function finish() {
    setComplete(true);
    persist(logs, true);
  }

  if (!block || !exercise) {
    return (
      <Panel className="p-8">
        <p className="text-[14px] text-muted">This template has no exercises yet.</p>
      </Panel>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-5">
        {/* ---- progress ---- */}
        <Panel className="p-6">
          <div className="flex items-baseline justify-between gap-4">
            <PanelHeader label={`${template.name} · ${doneSets} of ${totalSets} sets`} />
            {complete && <Badge tone="green">Complete</Badge>}
          </div>
          <div className="mt-4 h-px w-full bg-line-2">
            <motion.div
              className="h-px bg-green"
              initial={false}
              animate={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
              transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </Panel>

        {/* ---- current exercise ---- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={block.exerciseId}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Panel edge className="p-7 sm:p-8">
              <p className="im-micro">
                Exercise {index + 1} of {template.blocks.length}
              </p>
              <h2 className="im-display mt-3 text-[clamp(1.5rem,3.4vw,2.1rem)]">{exercise.name}</h2>

              <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
                <Metric label="Sets" value={String(block.sets)} />
                <Metric label="Reps" value={block.reps} />
                {block.tempo && <Metric label="Tempo" value={block.tempo} />}
                {block.rpeTarget != null && <Metric label="RPE" value={String(block.rpeTarget)} />}
                {block.restSeconds != null && <Metric label="Rest" value={`${block.restSeconds}s`} />}
              </dl>

              {/* video slot — labelled honestly rather than embedding a broken frame */}
              <div className="mt-7 flex aspect-video items-center justify-center border border-line bg-iron-2">
                {exercise.videoUrl ? (
                  <iframe
                    src={exercise.videoUrl}
                    title={`${exercise.name} demonstration`}
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="size-full"
                  />
                ) : (
                  <p className="im-micro">Demonstration footage to come</p>
                )}
              </div>

              {exercise.cues.length > 0 && (
                <div className="mt-7 border-t border-line pt-6">
                  <p className="im-micro">Coaching cues</p>
                  <ul className="mt-3 space-y-2">
                    {exercise.cues.map((c) => (
                      <li key={c} className="flex gap-3 text-[14px] leading-relaxed text-white">
                        <span aria-hidden className="mt-2.5 block h-px w-4 shrink-0 bg-green" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {block.notes && (
                <p className="mt-5 border-l-2 border-green bg-green/5 px-5 py-3.5 text-[13px] leading-relaxed">
                  {block.notes}
                </p>
              )}

              {/* ---- sets ---- */}
              <div className="mt-8 border-t border-line pt-7">
                <p className="im-micro">Mark each set as you finish it</p>
                <ul className="mt-4 space-y-2.5">
                  {Array.from({ length: block.sets }, (_, i) => {
                    const entry = logAt({ exerciseId: block.exerciseId, setIndex: i });
                    const done = Boolean(entry?.completed);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          aria-pressed={done}
                          onClick={() => toggleSet({ exerciseId: block.exerciseId, setIndex: i }, block.rpeTarget)}
                          className={`flex w-full items-center justify-between gap-4 rounded-xs border px-5 py-3.5 text-left transition-colors ${
                            done
                              ? 'border-green bg-green/10 text-white'
                              : 'border-line-2 text-muted hover:border-line-2 hover:text-white'
                          }`}
                        >
                          <span className="text-[13px] font-bold uppercase tracking-[0.12em]">
                            Set {i + 1} · {block.reps}
                          </span>
                          <span className="im-mono text-[12px]">
                            {done ? `✓ RPE ${entry?.rpe ?? block.rpeTarget ?? '—'}` : 'Tap when done'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
                <Button variant="quiet" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                  Previous
                </Button>
                {index < template.blocks.length - 1 ? (
                  <Button onClick={() => setIndex((i) => i + 1)}>Next exercise</Button>
                ) : (
                  <Button onClick={finish} disabled={complete}>
                    {complete ? 'Session complete' : 'Finish session'}
                  </Button>
                )}
              </div>

              {status && (
                <p role="status" className="mt-4 text-[12px] font-bold text-green">
                  {status}
                </p>
              )}
            </Panel>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ---- side rail ---- */}
      <div className="space-y-5">
        <Panel className="p-6">
          <PanelHeader label="Rest timer" />
          <p
            className={`im-mono mt-5 text-[clamp(2.4rem,6vw,3rem)] font-extrabold leading-none ${
              restLeft === 0 ? 'text-green' : ''
            }`}
            role="timer"
            aria-live="polite"
          >
            {restLeft == null ? '—' : restLeft === 0 ? 'GO' : formatDuration(restLeft)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[60, 90, 120, 180].map((s) => (
              <Button key={s} variant="ghost" size="sm" onClick={() => setRestLeft(s)}>
                {s}s
              </Button>
            ))}
            {restLeft != null && (
              <Button variant="quiet" size="sm" onClick={() => setRestLeft(null)}>
                Stop
              </Button>
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-2">
            Starts on its own when you tick a set with a prescribed rest.
          </p>
        </Panel>

        <Panel className="p-6">
          <PanelHeader label="Session RPE" />
          <div className="mt-5">
            <ScaleInput
              value={logs.at(-1)?.rpe ?? block.rpeTarget ?? 7}
              onChange={(v) => {
                const next = logs.map((l, i) => (i === logs.length - 1 ? { ...l, rpe: v } : l));
                setLogs(next);
              }}
              lowLabel="Easy"
              highLabel="Maximal"
              ariaLabel="Session rate of perceived exertion"
            />
          </div>
        </Panel>

        <Panel className="p-6">
          <PanelHeader label="Notes for your coach" />
          <div className="mt-4">
            <Field label="" >
              {(p) => (
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Loads used, anything that felt off, anything that felt easy."
                  {...p}
                />
              )}
            </Field>
          </div>
        </Panel>

        <Panel className="p-6">
          <PanelHeader label="Session plan" />
          <ol className="mt-4 space-y-2.5">
            {template.blocks.map((b, i) => {
              const ex = byId.get(b.exerciseId);
              const setsDone = logs.filter((l) => l.exerciseId === b.exerciseId && l.completed).length;
              return (
                <li key={b.exerciseId}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`flex w-full items-center justify-between gap-3 py-1.5 text-left text-[13px] transition-colors ${
                      i === index ? 'text-green' : 'text-muted hover:text-white'
                    }`}
                  >
                    <span className="truncate">{ex?.name ?? 'Exercise'}</span>
                    <span className="im-mono shrink-0 text-[11px] text-muted-2">
                      {setsDone}/{b.sets}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-2 text-[14px] font-extrabold">{value}</dd>
    </div>
  );
}
