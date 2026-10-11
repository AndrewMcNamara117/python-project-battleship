import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { AssignmentReview } from '@/components/programme/AssignmentReview';
import { requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { startOfWeek, toISODate } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Assign programme' };

/**
 * The pre-assignment review.
 *
 * Nothing is written by loading this page. The coach reads what the programme
 * would do to this athlete's calendar, sees every conflict, and decides.
 */
export default async function AssignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const athleteId = one('athlete');
  if (!athleteId) notFound();

  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) notFound();

  // a programme starts on a Monday; snapping here means the review shows the
  // date it would actually use rather than the one that was typed
  const start = startOfWeek(one('start') || toISODate(new Date()));

  const repo = await getRepo();
  const preview = await repo.previewAssignment(id, athleteId, start);

  return (
    <AppPage>
      <PageHeader
        eyebrow={
          <Link href="/coach/programs" className="text-mint hover:underline">
            ← Programmes
          </Link>
        }
        title="Before you assign"
        lead={`What ${preview.template.name} would put in ${preview.athleteName}'s calendar, and where it does not fit them.`}
      />

      <AssignmentReview preview={preview} />
    </AppPage>
  );
}
