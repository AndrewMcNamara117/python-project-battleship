import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { ProgrammeBuilder } from '@/components/programme/ProgrammeBuilder';
import type { LibraryOption } from '@/components/programme/WeekGrid';
import { Badge } from '@/components/ui/Badge';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { DISCIPLINE_LABELS } from '@/lib/domain/programme-template';
import { originLabel } from '@/lib/domain/library';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Programme builder' };

export default async function ProgrammeBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoach();
  const { id } = await params;
  const repo = await getRepo();

  const [template, workouts, strength] = await Promise.all([
    repo.getProgramTemplateDetail(id),
    repo.listWorkoutTemplates(),
    repo.listStrengthTemplates(),
  ]);
  if (!template) notFound();

  // the builder is assembled from the real libraries, so a coach never
  // rewrites a session that already exists
  const library: LibraryOption[] = [
    ...workouts.map((w) => ({ id: w.id, name: w.name, kind: 'workout' as const, distanceKm: w.distanceKm })),
    ...strength.map((s) => ({ id: s.id, name: s.name, kind: 'strength' as const, distanceKm: null })),
  ];

  const totalWeeks = template.blocks.reduce((a, b) => a + b.weeks.length, 0);
  const trainingDays = template.volume.length
    ? Math.max(...template.volume.map((v) => v.trainingDays))
    : 0;

  return (
    <AppPage>
      <PageHeader
        eyebrow={
          <Link href="/coach/programs" className="text-mint hover:underline">
            ← Programmes
          </Link>
        }
        title={template.name}
        lead={template.description || template.purpose || undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{originLabel(template, session.userId)}</Badge>
            <Badge tone="neutral">{DISCIPLINE_LABELS[template.discipline]}</Badge>
            <Badge tone="neutral">
              {EVENT_TYPE_LABELS[template.goalType as keyof typeof EVENT_TYPE_LABELS] ?? template.goalType}
            </Badge>
            <Badge tone="green">{totalWeeks} weeks</Badge>
          </div>
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-hairline pb-6 sm:grid-cols-4">
        <Stat label="Blocks" value={String(template.blocks.length)} />
        <Stat label="Weeks" value={String(totalWeeks)} />
        <Stat
          label="Written for"
          value={
            template.minDaysPerWeek && template.maxDaysPerWeek
              ? template.minDaysPerWeek === template.maxDaysPerWeek
                ? `${template.minDaysPerWeek} days`
                : `${template.minDaysPerWeek}–${template.maxDaysPerWeek} days`
              : 'Any frequency'
          }
        />
        <Stat label="Busiest week" value={trainingDays ? `${trainingDays} days` : '—'} />
      </dl>

      <ProgrammeBuilder template={template} library={library} />
    </AppPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="mt-1.5 text-[15px] font-bold text-ink">{value}</dd>
    </div>
  );
}
