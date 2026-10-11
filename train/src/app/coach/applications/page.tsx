import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo, isDemoMode } from '@/lib/data';
import { ApplicationCard } from './ApplicationCard';

export const metadata: Metadata = { title: 'Applications' };

export default async function ApplicationsPage() {
  await requireCoach();
  const repo = await getRepo();
  const applications = await repo.listApplications();

  const open = applications.filter((a) => a.status === 'new' || a.status === 'reviewing');
  const decided = applications.filter((a) => a.status === 'accepted' || a.status === 'declined');

  return (
    <AppPage>
      <PageHeader
        eyebrow="Intake"
        title="Applications"
        lead="Everyone who has asked to be coached. Accepting links them to you; nothing is charged until coaching starts."
        action={<Badge tone={open.length ? 'green' : 'neutral'}>{open.length} open</Badge>}
      />

      {isDemoMode() && (
        <Panel className="mt-8 border-warn/35 bg-warn/6 p-5">
          <p className="im-micro text-warn">Demo mode</p>
          <p className="mt-2.5 max-w-[70ch] text-[13px] leading-relaxed text-white">
            Applications submitted in demo mode live in server memory and are lost when the process
            restarts. Accepting one creates the athlete immediately, because there is no
            authentication here. With a database attached, accepting records the decision and the
            athlete joins your roster when they register.
          </p>
        </Panel>
      )}

      <section className="mt-8 space-y-5">
        {open.map((a) => (
          <Reveal key={a.id}>
            <ApplicationCard application={a} />
          </Reveal>
        ))}

        {!open.length && (
          <Panel className="p-8">
            <p className="text-[15px] text-muted">
              No open applications. New ones from{' '}
              <span className="text-white">/apply</span> land here.
            </p>
          </Panel>
        )}
      </section>

      {decided.length > 0 && (
        <section className="mt-12">
          <h2 className="im-micro">Decided</h2>
          <div className="mt-5 space-y-5">
            {decided.map((a) => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </div>
        </section>
      )}
    </AppPage>
  );
}
