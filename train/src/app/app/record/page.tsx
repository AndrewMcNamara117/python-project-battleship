import type { Metadata } from 'next';
import { Recorder } from '@/components/activity/Recorder';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export const metadata: Metadata = { title: 'Record' };

/** RECORD — GPS from the phone, for a run without a watch. */
export default async function RecordPage() {
  const session = await requireSession();
  const profile = await (await getRepo()).getProfile(session.userId);
  return (
    <AppPage>
      <AppHeader
        eyebrow="Record"
        title="No watch? Record here"
        lead="GPS from your phone, saved through the same import as a watch file — it lands on today’s session, with route, splits and records."
      />
      <Panel className="mx-auto mt-7 max-w-xl p-5 sm:p-7">
        <Recorder units={profile?.units ?? 'metric'} />
      </Panel>
    </AppPage>
  );
}
