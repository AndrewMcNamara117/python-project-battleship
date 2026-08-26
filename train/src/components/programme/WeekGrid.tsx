'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { deleteSlot, saveSlot } from '@/app/actions/programme-templates';
import type { ProgramTemplateSlot, TemplateWeekVolume } from '@/lib/domain/programme-template';
import { WEEKDAY_SHORT } from '@/lib/domain/types';
import type { Weekday } from '@/lib/domain/types';

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface LibraryOption {
  id: string;
  name: string;
  kind: 'workout' | 'strength';
  distanceKm: number | null;
}

/**
 * One template week, seven days across.
 *
 * A day with nothing in it is empty, and that is different from a rest day: a
 * rest day is something the coach decided. An athlete who trains three days a
 * week should see four blank days and the rests their coach meant, not seven
 * sessions invented to fill the row.
 */
export function WeekGrid({
  programTemplateId,
  weekId,
  slots,
  volume,
  library,
  editable,
}: {
  programTemplateId: string;
  weekId: string;
  slots: ProgramTemplateSlot[];
  volume: TemplateWeekVolume | undefined;
  library: LibraryOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<Weekday | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message);
      else {
        setAdding(null);
        router.refresh();
      }
    });

  const byDay = (day: Weekday) => slots.filter((s) => s.weekday === day).sort((a, b) => a.slot - b.slot);
  const nextSlot = (day: Weekday) => {
    const used = byDay(day).map((s) => s.slot);
    let n = 0;
    while (used.includes(n)) n++;
    return n;
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAYS.map((day) => {
          const daySlots = byDay(day);
          return (
            <div key={day} className="min-w-0 rounded-xs border border-hairline bg-slate/40 p-2.5">
              <p className="im-micro">{WEEKDAY_SHORT[day]}</p>

              <div className="mt-2 space-y-1.5">
                {daySlots.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-[2px] border px-2 py-1.5 text-[11px] leading-snug ${
                      s.isRest
                        ? 'border-hairline text-ink-tertiary'
                        : 'border-hairline-strong text-ink-body'
                    }`}
                  >
                    <span className="block truncate font-semibold">
                      {s.isRest
                        ? 'Rest'
                        : (s.label
                          ?? library.find((l) => l.id === (s.workoutTemplateId ?? s.strengthTemplateId))?.name
                          ?? 'Session')}
                    </span>
                    {s.strengthTemplateId && (
                      <span className="im-mono text-[10px] text-mint">S&amp;C</span>
                    )}
                    {!s.isRest && s.distanceKm != null && (
                      <span className="im-mono text-[10px] text-ink-tertiary">{s.distanceKm} km</span>
                    )}
                    {editable && (
                      <button
                        type="button"
                        className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-ink-tertiary hover:text-status-missed focus-visible:text-status-missed"
                        onClick={() => run(() => deleteSlot(programTemplateId, s.id))}
                        disabled={pending}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}

                {editable && adding !== day && (
                  <button
                    type="button"
                    onClick={() => { setAdding(day); setError(null); }}
                    className="w-full rounded-[2px] border border-dashed border-hairline-strong py-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-tertiary transition-colors hover:border-mint hover:text-mint focus-visible:border-mint focus-visible:text-mint"
                  >
                    Add
                  </button>
                )}

                {editable && adding === day && (
                  <SlotPicker
                    library={library}
                    pending={pending}
                    onCancel={() => setAdding(null)}
                    onPick={(choice) =>
                      run(() =>
                        saveSlot({
                          programTemplateId,
                          templateWeekId: weekId,
                          weekday: day,
                          slot: nextSlot(day),
                          kind: choice.kind,
                          templateId: choice.templateId,
                          label: null,
                          notes: null,
                          distanceKm: choice.distanceKm,
                          durationMinutes: null,
                          rpeTarget: null,
                        }),
                      )
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {volume && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-ink-tertiary">
          <span className="im-mono">
            {volume.trainingDays} training {volume.trainingDays === 1 ? 'day' : 'days'}
          </span>
          {volume.restDays > 0 && <span className="im-mono">{volume.restDays} rest</span>}
          <VolumeReadout volume={volume} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12px] text-status-missed">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Prescribed against intent.
 *
 * target_volume_km is what the coach meant; the prescribed figure is computed
 * from the sessions actually in the week. Showing the gap is the whole point —
 * it is not an error, and nothing is stopped because of it.
 */
export function VolumeReadout({ volume }: { volume: TemplateWeekVolume }) {
  if (volume.targetKm == null) {
    return <span className="im-mono">{volume.prescribedKm} km prescribed</span>;
  }
  const diff = Math.round((volume.prescribedKm - volume.targetKm) * 10) / 10;
  const off = Math.abs(diff) > Math.max(volume.targetKm * 0.15, 5);
  return (
    <span className={`im-mono ${off ? 'text-status-missed' : ''}`}>
      {volume.prescribedKm} km against {volume.targetKm} km
      {diff !== 0 && ` (${diff > 0 ? '+' : ''}${diff})`}
    </span>
  );
}

function SlotPicker({
  library,
  pending,
  onPick,
  onCancel,
}: {
  library: LibraryOption[];
  pending: boolean;
  onPick: (choice: { kind: 'workout' | 'strength' | 'rest'; templateId: string | null; distanceKm: number | null }) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-1.5 rounded-[2px] border border-mint/40 p-1.5">
      <label className="sr-only" htmlFor="slot-session">
        Session
      </label>
      <Select
        id="slot-session"
        className="w-full text-[11px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
      >
        <option value="">Choose…</option>
        <option value="rest">Rest day</option>
        {library.map((l) => (
          <option key={l.id} value={l.id}>
            {l.kind === 'strength' ? `S&C — ${l.name}` : l.name}
          </option>
        ))}
      </Select>

      <div className="flex gap-1">
        <Button
          size="sm"
          className="flex-1 px-2 py-1 text-[10px]"
          disabled={pending || !value}
          onClick={() => {
            if (value === 'rest') return onPick({ kind: 'rest', templateId: null, distanceKm: null });
            const item = library.find((l) => l.id === value);
            if (item) onPick({ kind: item.kind, templateId: item.id, distanceKm: item.distanceKm });
          }}
        >
          Add
        </Button>
        <Button
          variant="quiet"
          size="sm"
          className="px-2 py-1 text-[10px]"
          onClick={onCancel}
          disabled={pending}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}

/** The coach's intent for the week, which is a number only they can supply. */
export function WeekIntent({
  programTemplateId,
  weekId,
  targetVolumeKm,
  isRecoveryWeek,
  onSave,
  pending,
}: {
  programTemplateId: string;
  weekId: string;
  targetVolumeKm: number | null;
  isRecoveryWeek: boolean;
  onSave: (target: number | null, recovery: boolean) => void;
  pending: boolean;
}) {
  const [target, setTarget] = useState(targetVolumeKm?.toString() ?? '');
  const [recovery, setRecovery] = useState(isRecoveryWeek);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="im-micro" htmlFor={`intent-${weekId}`}>
        Target km
      </label>
      <Input
        id={`intent-${weekId}`}
        type="number"
        min="0"
        step="0.5"
        className="w-24 text-[12px]"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        onBlur={() => onSave(target.trim() === '' ? null : Number(target), recovery)}
        disabled={pending}
      />
      <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
        <input
          type="checkbox"
          className="size-3.5 appearance-none rounded-[2px] border border-hairline-strong bg-slate checked:border-mint checked:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
          checked={recovery}
          onChange={(e) => { setRecovery(e.target.checked); onSave(target.trim() === '' ? null : Number(target), e.target.checked); }}
          disabled={pending}
        />
        Step-back week
      </label>
      <input type="hidden" value={programTemplateId} readOnly />
    </div>
  );
}
