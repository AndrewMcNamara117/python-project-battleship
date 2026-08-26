'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { saveStrengthExercise } from '@/app/actions/library';
import type { StrengthExercise } from '@/lib/domain/library';
import { MOVEMENT_PATTERN_LABELS } from '@/lib/domain/library';
import { STRENGTH_CATEGORY_LABELS } from '@/lib/domain/types';

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const list = (v: string) => v.split('\n').map((t) => t.trim()).filter(Boolean);

/** A movement, with the defaults a coach starts from and then overrides per athlete. */
export function StrengthExerciseEditor({
  exercise,
  onDone,
}: {
  exercise?: StrengthExercise;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: exercise?.name ?? '',
    category: exercise?.category ?? 'foundation',
    movementPattern: exercise?.movementPattern ?? 'squat',
    description: exercise?.description ?? '',
    defaultSets: exercise?.defaultSets?.toString() ?? '',
    defaultReps: exercise?.defaultReps ?? '',
    loadGuidance: exercise?.loadGuidance ?? '',
    defaultRestSeconds: exercise?.defaultRestSeconds?.toString() ?? '',
    cues: exercise?.cues.join('\n') ?? '',
    equipment: exercise?.equipment.join('\n') ?? '',
    visibility: (exercise?.visibility === 'shared' ? 'shared' : 'private') as 'private' | 'shared',
    tags: exercise?.tags.join(', ') ?? '',
  });
  const [isUnilateral, setIsUnilateral] = useState(exercise?.isUnilateral ?? false);

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await saveStrengthExercise({
        id: exercise?.id,
        name: form.name,
        category: form.category,
        movementPattern: form.movementPattern,
        description: form.description.trim() || null,
        defaultSets: num(form.defaultSets),
        defaultReps: form.defaultReps.trim() || null,
        loadGuidance: form.loadGuidance.trim() || null,
        defaultRestSeconds: num(form.defaultRestSeconds),
        isUnilateral,
        cues: list(form.cues),
        equipment: list(form.equipment),
        visibility: form.visibility,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={submit}>
      <Panel className="p-6">
        <h2 className="im-display text-[1.25rem]">{exercise ? 'Edit movement' : 'New movement'}</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Name" className="md:col-span-2">
            {(p) => <Input {...p} value={form.name} onChange={update('name')} required maxLength={120} autoFocus />}
          </Field>

          <Field label="Category">
            {(p) => (
              <Select {...p} value={form.category} onChange={update('category')}>
                {Object.entries(STRENGTH_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Movement pattern" hint="How it loads the body.">
            {(p) => (
              <Select {...p} value={form.movementPattern} onChange={update('movementPattern')}>
                {Object.entries(MOVEMENT_PATTERN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Description" className="md:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={form.description} onChange={update('description')} maxLength={500} />}
          </Field>

          <Field label="Default sets">
            {(p) => <Input {...p} type="number" min="1" max="10" value={form.defaultSets} onChange={update('defaultSets')} />}
          </Field>

          <Field label="Default reps" hint="Free text — “8”, “10 each”, “30s”.">
            {(p) => <Input {...p} value={form.defaultReps} onChange={update('defaultReps')} maxLength={40} />}
          </Field>

          <Field label="Load guidance">
            {(p) => <Input {...p} value={form.loadGuidance} onChange={update('loadGuidance')} maxLength={120} />}
          </Field>

          <Field label="Rest (seconds)">
            {(p) => (
              <Input {...p} type="number" min="0" value={form.defaultRestSeconds} onChange={update('defaultRestSeconds')} />
            )}
          </Field>

          <Field label="Coaching cues" hint="One per line." className="md:col-span-2">
            {(p) => <Textarea {...p} rows={3} value={form.cues} onChange={update('cues')} maxLength={800} />}
          </Field>

          <Field label="Equipment" hint="One per line.">
            {(p) => <Textarea {...p} rows={2} value={form.equipment} onChange={update('equipment')} maxLength={300} />}
          </Field>

          <Field label="Tags" hint="Comma separated.">
            {(p) => <Input {...p} value={form.tags} onChange={update('tags')} />}
          </Field>

          <div className="md:col-span-2">
            <Checkbox
              label="Per side"
              description="Prescriptions read “8 each” rather than “8”."
              checked={isUnilateral}
              onChange={(e) => setIsUnilateral(e.target.checked)}
            />
          </div>

          <Field label="Visibility" hint="Shared means other coaches can use it. Only you can edit it.">
            {(p) => (
              <Select {...p} value={form.visibility} onChange={update('visibility')}>
                <option value="private">Private to me</option>
                <option value="shared">Shared with coaches</option>
              </Select>
            )}
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-5 text-[13px] leading-relaxed text-status-missed">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center gap-3 border-t border-hairline pt-5">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : exercise ? 'Save changes' : 'Save to library'}
          </Button>
          <Button type="button" variant="quiet" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        </div>
      </Panel>
    </form>
  );
}
