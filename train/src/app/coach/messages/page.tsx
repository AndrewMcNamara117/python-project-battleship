import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge, Dot } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { ReplyBox } from './MessageThread';

export const metadata: Metadata = { title: 'Messages' };

export default async function CoachMessagesPage() {
  const session = await requireCoach();
  const repo = await getRepo();
  const athletes = await repo.listAthletesForCoach(session.userId);

  const threads = await Promise.all(
    athletes.map(async (a) => ({
      athlete: a,
      messages: await repo.listMessages(a.id),
    })),
  );

  const active = threads
    .filter((t) => t.messages.length)
    .sort((x, y) => {
      const last = (t: (typeof threads)[number]) => t.messages.at(-1)?.createdAt ?? '';
      return last(y).localeCompare(last(x));
    });

  return (
    <AppPage>
      <PageHeader
        eyebrow="Coaching"
        title="Messages"
        lead="Most recent conversations first."
        action={<Badge tone="neutral">{active.length} active</Badge>}
      />

      <div className="mt-8 space-y-5">
        {active.map((t, i) => {
          const unread = t.messages.filter((m) => m.recipientId === session.userId && !m.readAt).length;
          return (
            <Reveal key={t.athlete.id} delay={Math.min(i * 0.04, 0.3)}>
              <Panel className="p-6 sm:p-8" edge={unread > 0}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/coach/athletes/${t.athlete.id}`}
                    className="im-display text-[1.2rem] transition-colors hover:text-green"
                  >
                    {t.athlete.fullName}
                  </Link>
                  {unread > 0 && <Badge tone="green">{unread} unread</Badge>}
                </div>

                <ol className="im-scroll mt-6 max-h-[280px] space-y-4 overflow-y-auto pr-1">
                  {t.messages.slice(-8).map((m) => {
                    const mine = m.senderId === session.userId;
                    return (
                      <li key={m.id} className={mine ? 'flex justify-end' : ''}>
                        <div
                          className={`max-w-[85%] rounded-xs border px-4 py-3 ${
                            mine ? 'border-green/30 bg-green/8' : 'border-line-2 bg-surface-2'
                          }`}
                        >
                          <p className="im-micro flex items-center gap-2">
                            {m.authorKind === 'forge' && <Dot />}
                            {mine ? 'You' : m.authorKind === 'forge' ? 'FORGE' : t.athlete.fullName}
                          </p>
                          <p className="mt-2 text-[13px] leading-relaxed text-white">{m.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-6 border-t border-line pt-6">
                  <ReplyBox athleteId={t.athlete.id} athleteName={t.athlete.fullName} />
                </div>
              </Panel>
            </Reveal>
          );
        })}

        {!active.length && (
          <Panel className="p-8">
            <p className="text-[15px] text-muted">No conversations yet.</p>
          </Panel>
        )}
      </div>
    </AppPage>
  );
}
