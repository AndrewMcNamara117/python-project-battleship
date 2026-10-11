'use client';

import { useState } from 'react';
import { AddToProgramme } from './AddToProgramme';
import { LibraryItemActions } from './LibraryItemActions';
import { StrengthExerciseEditor } from './StrengthExerciseEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Rise } from '@/components/motion/Rise';
import type { StrengthExercise, StrengthTemplate } from '@/lib/domain/library';
import { MOVEMENT_PATTERN_LABELS, originLabel } from '@/lib/domain/library';
import { STRENGTH_CATEGORY_LABELS } from '@/lib/domain/types';

/**
 * The strength library: sessions and the movements they are built from.
 *
 * Sessions come first because that is what a coach prescribes. The movement
 * list underneath is the vocabulary — what a coach edits when they want the
 * default sets, reps or cues to change for everything built from it after.
 */
export function StrengthLibrary({
  templates,
  exercises,
  coachId,
  athletes,
}: {
  templates: StrengthTemplate[];
  exercises: StrengthExercise[];
  coachId: string;
  athletes: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<StrengthExercise | 'new' | null>(null);

  if (editing) {
    return (
      <div className="mt-8">
        <StrengthExerciseEditor
          exercise={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      </div>
    );
  }

  const exerciseName = (id: string | null) =>
    exercises.find((e) => e.id === id)?.name ?? null;

  return (
    <>
      <section className="mt-10" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="im-eyebrow">
          Sessions
        </h2>

        {templates.length === 0 ? (
          <Panel className="mt-5 p-8 text-center">
            <p className="text-[14px] text-ink-secondary">No sessions match those filters.</p>
          </Panel>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {templates.map((t, i) => (
              <Rise key={t.id} delay={Math.min(i, 6) * 25}>
                <Panel className={`flex h-full flex-col p-6 ${t.archivedAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="im-micro">{STRENGTH_CATEGORY_LABELS[t.category]}</p>
                      <h3 className="im-display mt-3 text-[1.2rem]">{t.name}</h3>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
                        {originLabel(t, coachId)}
                        {t.archivedAt && ' · Archived'}
                      </p>
                    </div>
                    <Badge tone="neutral">{t.estimatedMinutes} min</Badge>
                  </div>

                  {t.description && (
                    <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">{t.description}</p>
                  )}

                  {t.components && t.components.length > 0 && (
                    <ol className="mt-5 space-y-2 border-t border-hairline pt-4">
                      {t.components.map((c) => (
                        <li key={c.id} className="flex items-baseline justify-between gap-4 text-[13px]">
                          <span className="text-ink-body">
                            {c.label ?? exerciseName(c.strengthExerciseId) ?? 'Movement'}
                          </span>
                          <span className="shrink-0 font-mono text-[12px] text-ink-tertiary">
                            {[c.sets && `${c.sets}×`, c.reps].filter(Boolean).join(' ')}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="flex-1" />

                  {!t.archivedAt && (
                    <AddToProgramme kind="strength" templateId={t.id} athletes={athletes} />
                  )}

                  <LibraryItemActions
                    kind="strength"
                    id={t.id}
                    name={t.name}
                    ownedByMe={t.ownerId === coachId && t.visibility !== 'system'}
                    isSystem={t.visibility === 'system'}
                    archived={Boolean(t.archivedAt)}
                  />
                </Panel>
              </Rise>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="movements-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="movements-heading" className="im-eyebrow">
            Movements
          </h2>
          <Button size="sm" onClick={() => setEditing('new')}>
            New movement
          </Button>
        </div>

        {exercises.length === 0 ? (
          <Panel className="mt-5 p-8 text-center">
            <p className="text-[14px] text-ink-secondary">No movements match those filters.</p>
          </Panel>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {exercises.map((e, i) => (
              <Rise key={e.id} delay={Math.min(i, 6) * 25}>
                <Panel className={`flex h-full flex-col p-6 ${e.archivedAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="im-micro">
                        {e.movementPattern ? MOVEMENT_PATTERN_LABELS[e.movementPattern] : 'Movement'}
                      </p>
                      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{e.name}</h3>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
                        {originLabel(e, coachId)}
                        {e.archivedAt && ' · Archived'}
                      </p>
                    </div>
                    {e.isUnilateral && <Badge tone="neutral">Per side</Badge>}
                  </div>

                  {(e.defaultSets || e.defaultReps) && (
                    <p className="mt-4 font-mono text-[12px] text-ink-secondary">
                      {[e.defaultSets && `${e.defaultSets} ×`, e.defaultReps].filter(Boolean).join(' ')}
                      {e.loadGuidance && ` · ${e.loadGuidance}`}
                    </p>
                  )}

                  {e.description && (
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">{e.description}</p>
                  )}

                  {e.cues.length > 0 && (
                    <ul className="mt-4 space-y-1.5 border-t border-hairline pt-4">
                      {e.cues.map((cue) => (
                        <li key={cue} className="text-[12px] leading-relaxed text-ink-body">
                          {cue}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex-1" />

                  <LibraryItemActions
                    kind="exercise"
                    id={e.id}
                    name={e.name}
                    ownedByMe={e.ownerId === coachId && e.visibility !== 'system'}
                    isSystem={e.visibility === 'system'}
                    archived={Boolean(e.archivedAt)}
                    onEdit={() => setEditing(e)}
                  />
                </Panel>
              </Rise>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
