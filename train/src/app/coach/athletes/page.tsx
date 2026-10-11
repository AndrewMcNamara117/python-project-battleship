import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { AthleteTable } from '@/components/app/AthleteTable';
import { Badge } from '@/components/ui/Badge';
import { loadCoachContext } from '@/lib/coach-data';

export const metadata: Metadata = { title: 'Athletes' };

export default async function AthletesPage() {
  const ctx = await loadCoachContext();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Roster"
        title="Athletes"
        lead="Sorted by who needs something. Click through for the full file."
        action={<Badge tone="neutral">{ctx.totals.athletes} coached</Badge>}
      />
      <div className="mt-8">
        <AthleteTable athletes={ctx.athletes} />
      </div>
    </AppPage>
  );
}
