import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { attentionFlag, type AthleteRow } from '@/lib/coach-data';
import { formatDayMonth } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

/**
 * The coach's working list. Ordered by who needs something, not alphabetically —
 * a list sorted by name is a list you have to read all of.
 */
export function AthleteTable({ athletes }: { athletes: AthleteRow[] }) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="im-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line-2 bg-iron-2">
              {['Athlete', 'Goal', 'To race', 'Week', 'Adherence', 'Last session', 'Check-in', 'Flag'].map((h) => (
                <th key={h} className="im-micro px-5 py-3.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => {
              const flag = attentionFlag(a);
              return (
                <tr key={a.profile.id} className="border-b border-line transition-colors hover:bg-white/2">
                  <td className="px-5 py-4">
                    <Link
                      href={`/coach/athletes/${a.profile.id}`}
                      className="text-[14px] font-bold transition-colors hover:text-green"
                    >
                      {a.profile.fullName}
                    </Link>
                    {a.unreadMessages > 0 && (
                      <span className="ml-2.5 align-middle">
                        <Badge tone="green">{a.unreadMessages}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[13px] text-muted">
                    {a.race?.name ?? (a.goal ? EVENT_TYPE_LABELS[a.goal.eventType] : '—')}
                  </td>
                  <td className="im-mono px-5 py-4 text-[13px]">
                    {a.daysToRace != null ? `${a.daysToRace}d` : '—'}
                  </td>
                  <td className="im-mono px-5 py-4 text-[13px]">
                    {a.sessionsThisWeek.completed}/{a.sessionsThisWeek.prescribed}
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2.5">
                      <span className="im-mono w-9 text-[13px] font-bold">{a.weekAdherencePct}%</span>
                      <span className="block h-px w-14 bg-line-2">
                        <span
                          className={`block h-px ${a.weekAdherencePct >= 80 ? 'bg-green' : 'bg-warn'}`}
                          style={{ width: `${a.weekAdherencePct}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="im-mono px-5 py-4 text-[12px] text-muted">
                    {a.lastWorkoutDate ? formatDayMonth(a.lastWorkoutDate) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    {a.checkInDue ? (
                      <Badge tone="warn">Due</Badge>
                    ) : a.lastCheckIn?.reviewedByCoachAt ? (
                      <Badge tone="neutral">Reviewed</Badge>
                    ) : (
                      <Badge tone="green">New</Badge>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={flag.tone}>{flag.label}</Badge>
                  </td>
                </tr>
              );
            })}
            {!athletes.length && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-[14px] text-muted">
                  No athletes linked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
