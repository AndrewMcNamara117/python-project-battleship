import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge, Dot } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { getRepo } from '@/lib/data';
import { loadCoachContext } from '@/lib/coach-data';
import { isClinical, waitedFor } from '@/lib/domain/roster';
import { ReplyBox } from './MessageThread';

export const metadata: Metadata = { title: 'Messages' };

export default async function CoachMessagesPage() {
  const ctx = await loadCoachContext();
  const repo = await getRepo();
  const session = { userId: ctx.coach.id };

  // The roster already knows who is waiting and since when. This page used to
  // work it out again from `read_at`, which nothing on the coach's side has
  // ever written — so every athlete who had ever sent a message showed "1
  // unread" for ever, and no control on this screen could clear it. Slice 12
  // settled what waiting means; this asks that, rather than holding a second
  // opinion nobody maintains.
  const threads = await Promise.all(
    ctx.roster.map(async (entry) => ({
      entry,
      athlete: { id: entry.athleteId, fullName: entry.fullName },
      messages: await repo.listMessages(entry.athleteId),
    })),
  );

  const withMessages = threads.filter((t) => t.messages.length);

  /**
   * Somebody waiting on a human answer comes before an answered thread, and
   * among those waiting, pain comes before a question about Thursday. Within
   * each group the longest wait leads: age is information, not severity.
   */
  const active = [...withMessages].sort((x, y) => {
    const waiting = (t: typeof x) => (t.entry.conversation ? 0 : 1);
    const clinical = (t: typeof x) => (t.entry.signals.some((s) => isClinical(s.kind)) ? 0 : 1);
    const since = (t: typeof x) => t.entry.conversation?.waitingSince ?? '';
    const last = (t: typeof x) => t.messages.at(-1)?.createdAt ?? '';
    return waiting(x) - waiting(y)
      || clinical(x) - clinical(y)
      || (x.entry.conversation ? since(x).localeCompare(since(y)) : last(y).localeCompare(last(x)));
  });

  const waitingCount = active.filter((t) => t.entry.conversation).length;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Coaching"
        title="Messages"
        lead={waitingCount
          ? 'Waiting on you first, longest wait at the top.'
          : 'Nobody is waiting on a reply.'}
        action={
          <Badge tone={waitingCount ? 'green' : 'neutral'}>
            {waitingCount ? `${waitingCount} waiting` : `${active.length} active`}
          </Badge>
        }
      />

      <div className="mt-8 space-y-5">
        {active.map((t, i) => {
          const waiting = t.entry.conversation;
          return (
            <Reveal key={t.athlete.id} delay={Math.min(i * 0.04, 0.3)}>
              <Panel className="p-6 sm:p-8" edge={Boolean(waiting)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/coach/athletes/${t.athlete.id}`}
                    className="im-display text-[1.2rem] transition-colors hover:text-green"
                  >
                    {t.athlete.fullName}
                  </Link>
                  {waiting && (
                    <Badge tone="green">
                      Waiting · {waitedFor(waiting.waitingSince, ctx.now)}
                    </Badge>
                  )}
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
