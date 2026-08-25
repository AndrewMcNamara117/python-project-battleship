import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { WORKOUT_TEMPLATES } from '@/data/workout-library';
import { requireCoach } from '@/lib/auth';
import { formatDistance, formatMinutes, formatPaceRange } from '@/lib/domain/dates';
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Workout library' };

export default async function WorkoutLibraryPage() {
  await requireCoach();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Library"
        title="Workouts"
        lead="Every session type the platform supports. Paces, zones and durations are defaults you edit per athlete — none of it is a prescription until you assign it."
        action={<Badge tone="neutral">{WORKOUT_TEMPLATES.length} templates</Badge>}
      />

      <RevealGroup className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKOUT_TEMPLATES.map((w) => (
          <RevealItem key={w.id}>
            <Panel hover className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="im-micro">{WORKOUT_TYPE_LABELS[w.type]}</p>
                  <h3 className="im-display mt-3 text-[1.2rem]">{w.name}</h3>
                </div>
                <Badge tone={w.intensity === 'hard' || w.intensity === 'max' ? 'green' : 'neutral'}>
                  {INTENSITY_LABELS[w.intensity]}
                </Badge>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
                {w.distanceKm != null && (
                  <Row label="Distance" value={formatDistance(w.distanceKm)} />
                )}
                {w.durationMinutes != null && <Row label="Duration" value={formatMinutes(w.durationMinutes)} />}
                {w.paceRange && <Row label="Pace" value={formatPaceRange(w.paceRange)} />}
                {w.hrZone != null && <Row label="Zone" value={`HR ${w.hrZone}`} />}
                {w.rpeTarget != null && <Row label="RPE" value={String(w.rpeTarget)} />}
                <Row label="Basis" value={w.basis.replace('_', ' ')} />
              </dl>

              {w.mainSet && (
                <p className="mt-5 flex-1 border-t border-line pt-4 text-[13px] leading-relaxed text-white">
                  {w.mainSet}
                </p>
              )}
              {w.notes && <p className="mt-4 text-[12px] leading-relaxed text-muted">{w.notes}</p>}
            </Panel>
          </RevealItem>
        ))}
      </RevealGroup>
    </AppPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-1.5 text-[13px] font-bold capitalize">{value}</dd>
    </div>
  );
}
