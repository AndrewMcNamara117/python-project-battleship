import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Rise } from '@/components/motion/Rise';
import { Badge, Dot } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { attentionLabel } from '@/lib/domain/checkin-rules';
import { formatDayMonth } from '@/lib/domain/dates';
import { MessageComposer } from './MessageComposer';

export const metadata: Metadata = { title: 'Your coach' };

export default async function CoachPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // opening the thread marks it read for this athlete
  await repo.markMessagesRead(ctx.session.userId, ctx.session.userId);
  const [messages, notes] = await Promise.all([
    repo.listMessages(ctx.session.userId),
    repo.listCoachNotes(ctx.session.userId, 'athlete'),
  ]);

  const reviewed = ctx.checkins.filter((c) => c.coachResponse).slice(0, 4);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Coaching"
        title={ctx.coach?.fullName ?? 'Your coach'}
        lead="Direct line. Messages are read by a person, not a bot."
        action={ctx.coach ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">Unassigned</Badge>}
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Rise>
          <Panel className="flex flex-col p-6 sm:p-8">
            <PanelHeader label="Conversation" />

            <ol className="im-scroll mt-6 max-h-[520px] space-y-5 overflow-y-auto pr-1">
              {messages.map((m) => {
                const mine = m.senderId === ctx.session.userId;
                const isForge = m.authorKind === 'forge';
                return (
                  <li key={m.id} className={mine ? 'flex justify-end' : ''}>
                    <div
                      className={`max-w-[85%] rounded-xs border px-5 py-4 ${
                        mine
                          ? 'border-green/30 bg-green/8'
                          : isForge
                            ? 'border-line-2 bg-iron-2'
                            : 'border-line-2 bg-surface-2'
                      }`}
                    >
                      <p className="im-micro flex items-center gap-2">
                        {isForge && <Dot />}
                        {mine ? 'You' : isForge ? 'FORGE' : (ctx.coach?.fullName ?? 'Coach')}
                        <span className="text-muted-2">
                          {new Date(m.createdAt).toLocaleDateString('en-IE', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </p>
                      <p className="mt-2.5 text-[14px] leading-relaxed text-white">{m.body}</p>
                    </div>
                  </li>
                );
              })}
              {!messages.length && (
                <li>
                  <p className="text-[14px] text-muted">No messages yet. Start the conversation below.</p>
                </li>
              )}
            </ol>

            <div className="mt-7 border-t border-line pt-7">
              {ctx.coach ? (
                <MessageComposer coachName={ctx.coach.fullName} />
              ) : (
                <p className="text-[14px] text-muted">
                  You are not linked to a coach yet. Once your application is accepted, this becomes
                  a direct line.
                </p>
              )}
            </div>
          </Panel>
        </Rise>

        <div className="space-y-5">
          <Rise delay={60}>
            <Panel className="p-6">
              <PanelHeader label="Notes shared with you" />
              <ul className="mt-5 space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-green pl-4">
                    <p className="text-[13px] leading-relaxed text-white">{n.body}</p>
                    <p className="im-mono mt-2 text-[11px] text-muted-2">
                      {formatDayMonth(n.createdAt.slice(0, 10))}
                    </p>
                  </li>
                ))}
                {!notes.length && <p className="text-[13px] text-muted">Nothing shared yet.</p>}
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted-2">
                Your coach also keeps private working notes. Those are theirs, and the database will
                not return them to you.
              </p>
            </Panel>
          </Rise>

          <Rise delay={100}>
            <Panel className="p-6">
              <PanelHeader label="Check-in responses" />
              <ul className="mt-5 space-y-5">
                {reviewed.map((c) => (
                  <li key={c.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="im-mono text-[12px] text-muted">{formatDayMonth(c.weekStart)}</span>
                      <Badge tone={c.attentionLevel === 'none' ? 'neutral' : 'warn'}>
                        {attentionLabel(c.attentionLevel)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-white">{c.coachResponse}</p>
                  </li>
                ))}
                {!reviewed.length && (
                  <p className="text-[13px] text-muted">No responses to your check-ins yet.</p>
                )}
              </ul>
            </Panel>
          </Rise>
        </div>
      </div>
    </AppPage>
  );
}
