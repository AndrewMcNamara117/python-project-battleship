'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WeekGrid, WeekIntent, type LibraryOption } from './WeekGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { addWeek, deleteBlock, deleteWeek, saveBlock, updateWeek } from '@/app/actions/programme-templates';
import type { ProgramTemplateDetail } from '@/lib/domain/programme-template';
import { PHASE_LABELS } from '@/lib/domain/types';

/**
 * The builder.
 *
 * Programme → Block → Week → Sessions, nested so the shape of the training is
 * the thing you see first. A flat calendar would hide the only structure that
 * matters here: which weeks belong to a base block and which to a taper.
 */
export function ProgrammeBuilder({
  template,
  library,
}: {
  template: ProgramTemplateDetail;
  library: LibraryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const editable = template.visibility !== 'system';

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message);
      else {
        setAddingBlock(false);
        router.refresh();
      }
    });

  const volumeFor = (weekNo: number) => template.volume.find((v) => v.templateWeekNo === weekNo);

  // a programme that says "4-5 days" and trains six is the mismatch a coach
  // would check against an athlete and be misled by
  const busiest = template.volume.length ? Math.max(...template.volume.map((v) => v.trainingDays)) : 0;
  const lightest = template.volume.length ? Math.min(...template.volume.map((v) => v.trainingDays)) : 0;
  const frequencyOff =
    template.maxDaysPerWeek != null && busiest > template.maxDaysPerWeek
      ? `The busiest week trains ${busiest} days, but this programme says it is written for at most ${template.maxDaysPerWeek}.`
      : template.minDaysPerWeek != null && lightest > 0 && lightest < template.minDaysPerWeek
        ? `The lightest week trains ${lightest} days, but this programme says it is written for at least ${template.minDaysPerWeek}.`
        : null;

  return (
    <div className="mt-8 space-y-5">
      {frequencyOff && (
        <Panel className="border-status-missed/40 p-4">
          <p className="text-[13px] leading-relaxed text-ink-body">
            {frequencyOff} Nothing is stopped by this — but a coach checking the programme against an
            athlete&rsquo;s availability will read the stated range, so it is worth correcting.
          </p>
        </Panel>
      )}

      {!editable && (
        <Panel className="p-4">
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            This is a programme Iron Miles ships, so it is read-only. Duplicate it to get a version you own
            and can edit.
          </p>
        </Panel>
      )}

      {template.blocks.length === 0 && (
        <Panel className="p-8 text-center">
          <p className="text-[14px] text-ink-secondary">
            No blocks yet. A programme is built from blocks — Base, Build, Taper — and the weeks inside them.
          </p>
        </Panel>
      )}

      {template.blocks.map((block) => (
        <Panel key={block.id} className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="im-micro">Block {block.blockIndex + 1}</p>
                {block.phase && <Badge tone="neutral">{PHASE_LABELS[block.phase] ?? block.phase}</Badge>}
                <Badge tone="neutral">
                  {block.weeks.length} {block.weeks.length === 1 ? 'week' : 'weeks'}
                </Badge>
              </div>
              <h3 className="im-display mt-2.5 text-[1.15rem]">{block.name}</h3>
              {block.focus && (
                <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">{block.focus}</p>
              )}
            </div>

            {editable && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => addWeek(template.id, block.id))}
                >
                  Add week
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => deleteBlock(template.id, block.id))}
                >
                  Remove block
                </Button>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-5">
            {block.weeks.map((week) => (
              <div key={week.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h4 className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                      Week {week.templateWeekNo}
                    </h4>
                    {week.isRecoveryWeek && <Badge tone="neutral">Step-back</Badge>}
                  </div>

                  {editable && (
                    <div className="flex flex-wrap items-center gap-3">
                      <WeekIntent
                        programTemplateId={template.id}
                        weekId={week.id}
                        targetVolumeKm={week.targetVolumeKm}
                        isRecoveryWeek={week.isRecoveryWeek}
                        pending={pending}
                        onSave={(target, recovery) =>
                          run(() =>
                            updateWeek({
                              programTemplateId: template.id,
                              weekId: week.id,
                              targetVolumeKm: target,
                              isRecoveryWeek: recovery,
                              focus: week.focus,
                              notes: week.notes,
                            }),
                          )
                        }
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => deleteWeek(template.id, week.id))}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <WeekGrid
                    programTemplateId={template.id}
                    weekId={week.id}
                    slots={week.slots}
                    volume={volumeFor(week.templateWeekNo)}
                    library={library}
                    editable={editable}
                  />
                </div>
              </div>
            ))}

            {block.weeks.length === 0 && (
              <p className="text-[13px] text-ink-tertiary">
                No weeks in this block yet.
              </p>
            )}
          </div>
        </Panel>
      ))}

      {editable && (
        addingBlock ? (
          <BlockForm
            templateId={template.id}
            blockIndex={template.blocks.length}
            pending={pending}
            onCancel={() => setAddingBlock(false)}
            onSave={(input) => run(() => saveBlock(input))}
          />
        ) : (
          <Button variant="ghost" onClick={() => setAddingBlock(true)} disabled={pending}>
            Add block
          </Button>
        )
      )}

      {error && (
        <p role="alert" className="text-[13px] leading-relaxed text-status-missed">
          {error}
        </p>
      )}
    </div>
  );
}

function BlockForm({
  templateId,
  blockIndex,
  pending,
  onSave,
  onCancel,
}: {
  templateId: string;
  blockIndex: number;
  pending: boolean;
  onSave: (input: {
    programTemplateId: string;
    blockIndex: number;
    name: string;
    phase: string | null;
    focus: string | null;
    description: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState('base');
  const [focus, setFocus] = useState('');

  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="im-display text-[1.1rem]">New block</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="im-micro">Name</span>
          <Input
            className="mt-1.5 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Base"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="im-micro">Phase</span>
          <Select className="mt-1.5 w-full" value={phase} onChange={(e) => setPhase(e.target.value)}>
            {Object.entries(PHASE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="im-micro">Focus</span>
          <Input
            className="mt-1.5 w-full"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="What this block is for"
          />
        </label>
      </div>
      <div className="mt-5 flex gap-3">
        <Button
          size="sm"
          disabled={pending || name.trim().length < 2}
          onClick={() =>
            onSave({
              programTemplateId: templateId,
              blockIndex,
              name: name.trim(),
              phase,
              focus: focus.trim() || null,
              description: null,
            })
          }
        >
          Add block
        </Button>
        <Button variant="quiet" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
