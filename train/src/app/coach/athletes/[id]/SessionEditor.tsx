'use client';

import { useState, useTransition } from 'react';
import { deleteScheduledWorkout, updateScheduledWorkout, type Result } from '@/app/actions/coach';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatDayMonth } from '@/lib/domain/dates';
import {
  INTENSITY_LABELS,
  WORKOUT_TYPE_LABELS,
  type Intensity,
  type ScheduledWorkout,
  type WorkoutType,
} from '@/lib/domain/types';

/**
 * Coach-side editing of a prescribed session.
 *
 * This is the half of the loop that makes coaching adaptive: the coach changes
 * the plan here and the athlete sees it on their next page load. Completed
 * sessions are read-only — they are a record of what happened, not a plan.
 */
export function SessionEditor({
  athleteId,
  sessions,
}: {
  athleteId: string;
  sessions: ScheduledWorkout[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader
        label="Prescribed sessions"
        action={<span className="text-[11px] text-muted-2">Edits are live for the athlete</span>}
      />

      {result && (
        <p
          role="status"
          className={`mt-4 text-[13px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}
        >
          {result.message}
        </p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {sessions.map((w) => (
          <li key={w.id} className="py-4">
            {editing === w.id ? (
              <EditForm
                workout={w}
                athleteId={athleteId}
                onDone={(r) => {
                  setResult(r);
                  if (r.ok) setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="im-mono w-16 shrink-0 text-[11px] text-muted-2">
                  {formatDayMonth(w.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{w.name}</span>
                  <span className="im-micro mt-1 block">
                    {WORKOUT_TYPE_LABELS[w.type]}
                    {w.distanceKm != null ? ` · ${w.distanceKm}km` : ''}
                    {w.durationMinutes != null ? ` · ${w.durationMinutes}min` : ''}
                  </span>
                </span>
                <Badge tone={w.status === 'completed' ? 'green' : 'neutral'}>{w.status}</Badge>
                {w.status === 'completed' ? (
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-2">Locked</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(w.id)}>
                    Edit
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
        {!sessions.length && (
          <li className="py-6">
            <p className="text-[14px] text-muted">
              Nothing prescribed in this window. Assign a programme from Programmes.
            </p>
          </li>
        )}
      </ul>
    </Panel>
  );
}

const TYPES = Object.keys(WORKOUT_TYPE_LABELS) as WorkoutType[];
const INTENSITIES = Object.keys(INTENSITY_LABELS) as Intensity[];

function EditForm({
  workout,
  athleteId,
  onDone,
  onCancel,
}: {
  workout: ScheduledWorkout;
  athleteId: string;
  onDone: (r: Result) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(workout);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set<K extends keyof ScheduledWorkout>(key: K, value: ScheduledWorkout[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="space-y-5 rounded-xs border border-line-2 bg-iron-2 p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Session name">
          {(p) => <Input value={draft.name} onChange={(e) => set('name', e.target.value)} {...p} />}
        </Field>
        <Field label="Date">
          {(p) => <Input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} {...p} />}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type">
          {(p) => (
            <Select value={draft.type} onChange={(e) => set('type', e.target.value as WorkoutType)} {...p}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {WORKOUT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Intensity">
          {(p) => (
            <Select
              value={draft.intensity}
              onChange={(e) => set('intensity', e.target.value as Intensity)}
              {...p}
            >
              {INTENSITIES.map((i) => (
                <option key={i} value={i}>
                  {INTENSITY_LABELS[i]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Distance (km)">
          {(p) => (
            <Input
              type="number"
              step="0.1"
              min={0}
              value={draft.distanceKm ?? ''}
              onChange={(e) => set('distanceKm', e.target.value === '' ? null : Number(e.target.value))}
              {...p}
            />
          )}
        </Field>
        <Field label="Duration (min)">
          {(p) => (
            <Input
              type="number"
              min={0}
              value={draft.durationMinutes ?? ''}
              onChange={(e) =>
                set('durationMinutes', e.target.value === '' ? null : Number(e.target.value))
              }
              {...p}
            />
          )}
        </Field>
        <Field label="RPE target">
          {(p) => (
            <Input
              type="number"
              min={1}
              max={10}
              value={draft.rpeTarget ?? ''}
              onChange={(e) => set('rpeTarget', e.target.value === '' ? null : Number(e.target.value))}
              {...p}
            />
          )}
        </Field>
      </div>

      <Field label="Main set">
        {(p) => (
          <Textarea
            rows={2}
            value={draft.mainSet ?? ''}
            onChange={(e) => set('mainSet', e.target.value || null)}
            {...p}
          />
        )}
      </Field>

      <Field label="Coach note" hint="Shown to the athlete on the session itself.">
        {(p) => (
          <Textarea
            rows={2}
            value={draft.coachNote ?? ''}
            onChange={(e) => set('coachNote', e.target.value || null)}
            {...p}
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => start(async () => onDone(await updateScheduledWorkout(draft)))}
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="quiet" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>

        <span className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-[11px] text-muted">Remove this session?</span>
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => onDone(await deleteScheduledWorkout(workout.id, athleteId)))
                }
              >
                Remove
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(true)}>
              Remove
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
