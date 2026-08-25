import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { STRENGTH_EXERCISES, STRENGTH_TEMPLATES, exerciseById } from '@/data/strength-library';
import { requireCoach } from '@/lib/auth';
import { STRENGTH_CATEGORY_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'S&C library' };

export default async function StrengthLibraryPage() {
  await requireCoach();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Library"
        title="Strength & conditioning"
        lead="Templates and the exercise library behind them. Clone anything and edit your copy."
        action={
          <div className="flex gap-2">
            <Badge tone="neutral">{STRENGTH_TEMPLATES.length} templates</Badge>
            <Badge tone="neutral">{STRENGTH_EXERCISES.length} exercises</Badge>
          </div>
        }
      />

      <section className="mt-8">
        <h2 className="im-micro">Templates</h2>
        <RevealGroup className="mt-5 grid gap-4 lg:grid-cols-2">
          {STRENGTH_TEMPLATES.map((t) => (
            <RevealItem key={t.id}>
              <Panel hover className="h-full p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="im-display text-[1.2rem]">{t.name}</h3>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{STRENGTH_CATEGORY_LABELS[t.category]}</Badge>
                    <Badge tone="green">{t.estimatedMinutes}m</Badge>
                  </div>
                </div>
                <p className="mt-3.5 text-[13px] leading-relaxed text-muted">{t.description}</p>

                <ol className="mt-5 divide-y divide-line border-t border-line">
                  {t.blocks.map((b) => (
                    <li key={b.exerciseId} className="flex items-center gap-4 py-3">
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {exerciseById(b.exerciseId)?.name ?? b.exerciseId}
                      </span>
                      <span className="im-mono shrink-0 text-[12px] text-muted">
                        {b.sets} × {b.reps}
                        {b.rpeTarget ? ` @ RPE ${b.rpeTarget}` : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="mt-12">
        <h2 className="im-micro">Exercise library</h2>
        <Reveal>
          <Panel className="mt-5 p-0">
            <ul className="divide-y divide-line">
              {STRENGTH_EXERCISES.map((e) => (
                <li key={e.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold">{e.name}</h3>
                      <p className="im-micro mt-1.5 capitalize">
                        {e.category} · {e.muscleGroups.join(', ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {e.equipment.length ? (
                        e.equipment.map((q) => (
                          <Badge key={q} tone="neutral">
                            {q}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="neutral">Bodyweight</Badge>
                      )}
                      <Badge tone={e.videoUrl ? 'green' : 'warn'}>
                        {e.videoUrl ? 'Video' : 'Footage to come'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-3">
                    <Column label="Cues" items={e.cues} />
                    <Column label="Regressions" items={e.regressions} />
                    <Column label="Progressions" items={e.progressions} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>

      <p className="mt-8 max-w-[74ch] text-[12px] leading-relaxed text-muted-2">
        Exercise selection and loading are coaching decisions. Nothing in this library is a
        rehabilitation protocol, and an athlete with a current injury needs a qualified clinician
        before any of it is assigned.
      </p>
    </AppPage>
  );
}

function Column({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <PanelHeader label={label} />
      <ul className="mt-2.5 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="text-[12px] leading-relaxed text-muted">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
