'use client';

import { useState } from 'react';
import { AddToProgramme } from './AddToProgramme';
import { LibraryItemActions } from './LibraryItemActions';
import { WorkoutTemplateEditor } from './WorkoutTemplateEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Rise } from '@/components/motion/Rise';
import type { WorkoutTemplate } from '@/lib/domain/library';
import { WORKOUT_CATEGORY_LABELS, originLabel } from '@/lib/domain/library';
import { formatDistance, formatMinutes } from '@/lib/domain/dates';
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '@/lib/domain/types';

/**
 * The endurance library.
 *
 * Everything here is reusable material, not a prescription. The card says
 * where each session came from, because "who owns this" decides what a coach
 * is allowed to do with it — and a control that would be refused should not be
 * shown at all.
 */
export function WorkoutLibrary({
  templates,
  coachId,
  athletes,
}: {
  templates: WorkoutTemplate[];
  coachId: string;
  athletes: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<WorkoutTemplate | 'new' | null>(null);

  if (editing) {
    return (
      <div className="mt-8">
        <WorkoutTemplateEditor
          template={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={() => setEditing('new')}>
          New session
        </Button>
      </div>

      {templates.length === 0 ? (
        <Panel className="mt-6 p-8 text-center">
          <p className="text-[14px] text-ink-secondary">Nothing matches those filters.</p>
        </Panel>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((w, i) => {
            const mine = w.ownerId === coachId && w.visibility !== 'system';
            return (
              <Rise key={w.id} delay={Math.min(i, 6) * 25}>
                <Panel className={`flex h-full flex-col p-6 ${w.archivedAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="im-micro">{WORKOUT_CATEGORY_LABELS[w.category]}</p>
                      <h3 className="im-display mt-3 text-[1.2rem]">{w.name}</h3>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
                        {originLabel(w, coachId)}
                        {w.archivedAt && ' · Archived'}
                      </p>
                    </div>
                    <Badge tone={w.intensity === 'hard' || w.intensity === 'max' ? 'green' : 'neutral'}>
                      {INTENSITY_LABELS[w.intensity]}
                    </Badge>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-4">
                    <Row label="Type" value={WORKOUT_TYPE_LABELS[w.type]} />
                    {w.distanceKm != null && <Row label="Distance" value={formatDistance(w.distanceKm)} />}
                    {w.durationMinutes != null && <Row label="Duration" value={formatMinutes(w.durationMinutes)} />}
                    {w.hrZone != null && <Row label="Zone" value={`HR ${w.hrZone}`} />}
                    {w.rpeTarget != null && <Row label="RPE" value={String(w.rpeTarget)} />}
                  </dl>

                  {w.mainSet && (
                    <p className="mt-5 flex-1 border-t border-hairline pt-4 text-[13px] leading-relaxed text-ink-body">
                      {w.mainSet}
                    </p>
                  )}
                  {w.purpose && <p className="mt-4 text-[12px] leading-relaxed text-ink-secondary">{w.purpose}</p>}

                  {!w.archivedAt && (
                    <AddToProgramme kind="workout" templateId={w.id} athletes={athletes} />
                  )}

                  <LibraryItemActions
                    kind="workout"
                    id={w.id}
                    name={w.name}
                    ownedByMe={mine}
                    isSystem={w.visibility === 'system'}
                    archived={Boolean(w.archivedAt)}
                    onEdit={() => setEditing(w)}
                  />
                </Panel>
              </Rise>
            );
          })}
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
