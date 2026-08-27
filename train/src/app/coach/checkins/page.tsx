import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { attentionLabel } from '@/lib/domain/checkin-rules';
import { formatDayMonth } from '@/lib/domain/dates';
import { CheckInResponder } from '../athletes/[id]/CoachControls';
import { CheckInAdapt } from '@/components/roster/CheckInAdapt';

export const metadata: Metadata = { title: 'Check-in queue' };

export default async function CheckInQueuePage() {
  const session = await requireCoach();
  const repo = await getRepo();
  const queue = await repo.listCheckInQueue(session.userId);

  const pending = queue.filter((c) => !c.reviewedByCoachAt);
  const reviewed = queue.filter((c) => c.reviewedByCoachAt).slice(0, 12);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Review queue"
        title="Check-ins"
        lead="Flagged check-ins first, then unread, then everything else."
        action={<Badge tone={pending.length ? 'green' : 'neutral'}>{pending.length} waiting</Badge>}
      />

      <div className="mt-8 space-y-5">
        {pending.map((c, i) => (
          <Reveal key={c.id} delay={Math.min(i * 0.04, 0.3)}>
            <Panel edge={c.attentionLevel !== 'none'} className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/coach/athletes/${c.athleteId}`}
                    className="im-display text-[1.3rem] transition-colors hover:text-green"
                  >
                    {c.athleteName}
                  </Link>
                  <p className="im-mono mt-2 text-[12px] text-muted">
                    Week of {formatDayMonth(c.weekStart)}
                  </p>
                </div>
                <Badge
                  tone={
                    c.attentionLevel === 'attention' ? 'alert' : c.attentionLevel === 'watch' ? 'warn' : 'neutral'
                  }
                >
                  {attentionLabel(c.attentionLevel)}
                </Badge>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 sm:grid-cols-4 lg:grid-cols-7">
                {Object.entries(c.scores).map(([k, v]) => (
                  <div key={k}>
                    <dt className="im-micro">{k.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd
                      className={`im-mono mt-1.5 text-[16px] font-extrabold ${
                        (k === 'soreness' || k === 'fatigue' || k === 'stress') && v >= 8
                          ? 'text-alert'
                          : (k === 'sleep' || k === 'motivation') && v <= 3
                            ? 'text-alert'
                            : ''
                      }`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {c.attentionReasons.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {c.attentionReasons.map((r) => (
                    <li key={r}>
                      <Badge tone="warn">{r}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                {[
                  ['Went well', c.wentWell],
                  ['Felt difficult', c.feltDifficult],
                  ['Pain or niggles', c.painOrNiggles],
                  ['Affecting training', c.affectingTraining],
                  ['Confidence next week', c.confidenceNextWeek],
                  ['For you', c.forCoach],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="im-micro">{label}</p>
                      <p className="mt-2 text-[13px] leading-relaxed text-white">{value}</p>
                    </div>
                  ))}
              </div>

              <div className="mt-7 border-t border-line pt-6">
                <CheckInResponder checkInId={c.id} athleteId={c.athleteId} existing={c.coachResponse} />
              </div>

              {/* the seam the audit found: a coach can change next week from
                  here, with what the athlete wrote still on screen above */}
              <div className="mt-5">
                <CheckInAdapt
                  athleteId={c.athleteId}
                  athleteName={c.athleteName}
                  weekStart={c.weekStart}
                />
              </div>
            </Panel>
          </Reveal>
        ))}

        {!pending.length && (
          <Panel className="p-8">
            <p className="text-[15px] text-muted">Queue clear. Every check-in has a response.</p>
          </Panel>
        )}
      </div>

      {reviewed.length > 0 && (
        <section className="mt-12">
          <h2 className="im-micro">Recently reviewed</h2>
          <Panel className="mt-5 overflow-hidden p-0">
            <ul>
              {reviewed.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-4 last:border-b-0">
                  <Link
                    href={`/coach/athletes/${c.athleteId}`}
                    className="min-w-[140px] text-[14px] font-bold transition-colors hover:text-green"
                  >
                    {c.athleteName}
                  </Link>
                  <span className="im-mono text-[12px] text-muted-2">{formatDayMonth(c.weekStart)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{c.coachResponse}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </AppPage>
  );
}
