'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SessionHistory } from './SessionHistory';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import {
  applyShift, applyVolume, moveSession, previewShift, previewVolume, swapSessions,
} from '@/app/actions/adaptation';
import { summarise } from '@/lib/domain/adaptation';
import type { CheckInContext, ShiftRow, VolumeRow, WeekSession } from '@/lib/domain/adaptation';
import { addDays, formatDayMonth } from '@/lib/domain/dates';
import { WEEKDAY_SHORT } from '@/lib/domain/types';
import type { Weekday } from '@/lib/domain/types';

type Preview =
  | { kind: 'shift'; days: number; rows: ShiftRow[] }
  | { kind: 'volume'; percent: number; rows: VolumeRow[] };

/**
 * Changing a week, rather than seven days one at a time.
 *
 * Everything here is a coaching decision a coach actually makes: the week
 * moves, the volume comes down, two sessions swap. Bulk changes are previewed
 * and confirmed; nothing that has already happened can be touched.
 */
export function WeekAdaptation({
  athleteId,
  weekStart,
  weekNo,
  sessions,
  checkIn,
  programmeEnd,
}: {
  athleteId: string;
  weekStart: string;
  weekNo: number;
  sessions: WeekSession[];
  checkIn: CheckInContext | null;
  /** The last day of the programme, for shifting everything from here on. */
  programmeEnd: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [days, setDays] = useState('1');
  /**
   * Shifting one week alone rarely works: the week after it is already full,
   * so every session is blocked by the one it would land on. An athlete who
   * loses a week wants everything after it to slide, which is why that is the
   * default.
   */
  const [scope, setScope] = useState<'week' | 'programme'>('programme');
  const [percent, setPercent] = useState('90');
  const [swapA, setSwapA] = useState('');
  const [swapB, setSwapB] = useState('');
  const [showEvery, setShowEvery] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const shiftTo = scope === 'week' ? weekEnd : (programmeEnd > weekEnd ? programmeEnd : weekEnd);
  const adaptable = sessions.filter((s) => !s.blocker);

  const run = (action: () => Promise<{ ok: boolean; message: string }>, clearPreview = true) =>
    startTransition(async () => {
      setResult(null);
      const outcome = await action();
      setResult(outcome.message ? outcome : null);
      if (outcome.ok) {
        if (clearPreview) setPreview(null);
        router.refresh();
      }
    });

  const summary = preview ? summarise(preview.rows) : null;
  const changing = preview?.rows.filter((r) => r.action === 'move' || r.action === 'scale') ?? [];
  const needsAttention = preview?.rows.filter((r) => r.action === 'blocked' || r.action === 'keep') ?? [];

  return (
    <Panel className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <p className="im-micro">Week {weekNo}</p>
          <h3 className="im-display mt-2 text-[1.1rem]">
            {formatDayMonth(weekStart)} – {formatDayMonth(weekEnd)}
          </h3>
        </div>
        <p className="text-[12px] text-ink-tertiary">
          {adaptable.length} of {sessions.length} can be changed
        </p>
      </div>

      {checkIn && <CheckInNote checkIn={checkIn} />}

      {/* the week itself */}
      <ol className="mt-5 space-y-3">
        {sessions.map((s) => (
          <li key={s.sessionId} className="min-w-0 border-b border-hairline pb-3 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">
                  <span className="im-mono mr-2.5 text-[11px] text-ink-tertiary">
                    {WEEKDAY_SHORT[(((new Date(s.date).getUTCDay() + 6) % 7) + 1) as Weekday]}
                  </span>
                  {s.name}
                </p>
                <p className="mt-1 im-mono text-[11px] text-ink-tertiary">
                  {[s.distanceKm ? `${s.distanceKm} km` : null,
                    s.durationMinutes ? `${s.durationMinutes} min` : null].filter(Boolean).join(' · ')}
                  {s.movedFrom && ` · moved from ${formatDayMonth(s.movedFrom)}`}
                </p>
              </div>
              {s.blocker ? (
                <Badge tone="green">{s.status === 'completed' ? 'Done' : 'Logged'}</Badge>
              ) : (
                <MoveControl
                  weekStart={weekStart}
                  session={s}
                  pending={pending}
                  onMove={(date) => run(() => moveSession(athleteId, s.sessionId, date, s.slot))}
                />
              )}
            </div>

            {/* the badge already says "Done"; the sentence is only worth its
                space when the reason is not obvious from the status */}
            {s.blocker && s.status !== 'completed' && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-tertiary">{s.blocker}</p>
            )}

            <SessionHistory sessionId={s.sessionId} revisions={s.revisions} />
          </li>
        ))}
      </ol>

      {/* week-level moves */}
      <div className="mt-6 grid gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
        <div>
          <p className="im-micro">Shift sessions</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min="-14"
              max="14"
              className="w-[4.5rem] shrink-0"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-label="Days to shift by"
            />
            <span className="shrink-0 text-[12px] text-ink-secondary">days</span>
            <Select
              className="w-full min-w-0 sm:w-[11.5rem]"
              value={scope}
              onChange={(e) => { setScope(e.target.value as 'week' | 'programme'); setPreview(null); }}
              aria-label="What to shift"
            >
              <option value="programme">from here on</option>
              <option value="week">this week only</option>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || !Number(days)}
              onClick={() =>
                startTransition(async () => {
                  setResult(null);
                  const outcome = await previewShift(athleteId, weekStart, shiftTo, Number(days));
                  if (outcome.ok && outcome.rows) setPreview({ kind: 'shift', days: Number(days), rows: outcome.rows });
                  else setResult(outcome);
                  setShowEvery(false);
                })
              }
            >
              Preview
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-tertiary">
            Shifting one week on its own usually cannot move — the week after it is already full.
          </p>
        </div>

        <div>
          <p className="im-micro">Adjust this week&rsquo;s volume</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Select
              className="w-24 min-w-0"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              aria-label="Volume adjustment"
            >
              <option value="70">70%</option>
              <option value="80">80%</option>
              <option value="90">90%</option>
              <option value="110">110%</option>
              <option value="120">120%</option>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setResult(null);
                  const outcome = await previewVolume(athleteId, weekStart, weekEnd, Number(percent));
                  if (outcome.ok && outcome.rows) {
                    setPreview({ kind: 'volume', percent: Number(percent), rows: outcome.rows });
                  } else setResult(outcome);
                })
              }
            >
              Preview
            </Button>
          </div>
        </div>

        {adaptable.length >= 2 && (
          <div className="sm:col-span-2">
            <p className="im-micro">Swap two sessions</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Select className="w-full min-w-0 sm:w-[13rem]" value={swapA} onChange={(e) => setSwapA(e.target.value)} aria-label="First session">
                <option value="">Choose…</option>
                {adaptable.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {formatDayMonth(s.date)} · {s.name}
                  </option>
                ))}
              </Select>
              <Select className="w-full min-w-0 sm:w-[13rem]" value={swapB} onChange={(e) => setSwapB(e.target.value)} aria-label="Second session">
                <option value="">Choose…</option>
                {adaptable.filter((s) => s.sessionId !== swapA).map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {formatDayMonth(s.date)} · {s.name}
                  </option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending || !swapA || !swapB}
                onClick={() => run(() => swapSessions(athleteId, swapA, swapB))}
              >
                Swap
              </Button>
            </div>
          </div>
        )}
      </div>

      {preview && summary && (
        <div className="mt-5 border-t border-hairline pt-5">
          <p className="im-micro text-status-missed">
            {preview.kind === 'shift'
              ? `Shifting ${scope === 'week' ? 'this week' : 'everything from here on'} by ` +
                `${preview.days} day${Math.abs(preview.days) === 1 ? '' : 's'}`
              : `Setting volume to ${preview.percent}%`}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
            <span className="text-ink">{summary.changing} will change</span>
            <span className="text-ink-secondary">{summary.untouched} untouched</span>
            {summary.blocked > 0 && (
              <span className="text-status-missed">{summary.blocked} cannot be changed</span>
            )}
          </div>

          {/* What needs a decision comes first. Forty-five identical lines
              saying a session moves is not information a coach reads; the
              handful that will not move is. */}
          {needsAttention.length > 0 && (
            <ul className="mt-4 space-y-2">
              {needsAttention.map((row) => (
                <li key={row.sessionId} className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12.5px]">
                  <span
                    className={`im-mono text-[10px] uppercase tracking-[0.1em] ${
                      row.action === 'blocked' ? 'text-status-missed' : 'text-ink-tertiary'
                    }`}
                  >
                    {row.action === 'blocked' ? 'no' : '—'}
                  </span>
                  <span className="text-ink">{row.name}</span>
                  <span className="min-w-0 break-words text-ink-tertiary">{row.detail}</span>
                </li>
              ))}
            </ul>
          )}

          {changing.length > 0 && (
            <div className="mt-4">
              <Button variant="quiet" size="sm" className="px-0" onClick={() => setShowEvery((v) => !v)}>
                {showEvery
                  ? 'Hide the full list'
                  : `Show all ${changing.length} that will change`}
              </Button>
              {showEvery && (
                <ul className="mt-2.5 space-y-1.5">
                  {changing.map((row) => (
                    <li key={row.sessionId} className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-[12.5px]">
                      <span className="im-mono text-[10px] uppercase tracking-[0.1em] text-mint">yes</span>
                      <span className="text-ink">{row.name}</span>
                      <span className="min-w-0 break-words text-ink-tertiary">{row.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              disabled={pending || summary.changing === 0}
              onClick={() =>
                run(() =>
                  preview.kind === 'shift'
                    ? applyShift(athleteId, weekStart, shiftTo, preview.days)
                    : applyVolume(athleteId, weekStart, weekEnd, preview.percent))
              }
            >
              {pending ? 'Applying…' : `Apply to ${summary.changing} session${summary.changing === 1 ? '' : 's'}`}
            </Button>
            <Button variant="quiet" onClick={() => setPreview(null)} disabled={pending}>
              Cancel
            </Button>
            {summary.changing === 0 && (
              <p className="text-[12px] text-ink-tertiary">Nothing in this week would change.</p>
            )}
          </div>
        </div>
      )}

      {result && (
        <p
          role="status"
          className={`mt-5 text-[13px] leading-relaxed ${result.ok ? 'text-mint' : 'text-status-missed'}`}
        >
          {result.message}
        </p>
      )}
    </Panel>
  );
}

/** Move one session to another day of the same week. */
function MoveControl({
  weekStart,
  session,
  pending,
  onMove,
}: {
  weekStart: string;
  session: WeekSession;
  pending: boolean;
  onMove: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)} className="px-0">
        Move
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Select
        className="text-[12px]"
        defaultValue=""
        disabled={pending}
        aria-label={`Move ${session.name}`}
        onChange={(e) => { if (e.target.value) { onMove(e.target.value); setOpen(false); } }}
      >
        <option value="">Move to…</option>
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
          .filter((d) => d !== session.date)
          .map((d) => (
            <option key={d} value={d}>{formatDayMonth(d)}</option>
          ))}
      </Select>
      <Button variant="quiet" size="sm" onClick={() => setOpen(false)} className="px-0">
        ✕
      </Button>
    </div>
  );
}

/**
 * The athlete's own account of the week just gone.
 *
 * Shown, never acted on. Nothing here reads a number and decides anything —
 * a rule over six scores is not coaching, and dressing one up as coaching
 * would be worse than showing the coach nothing at all.
 */
function CheckInNote({ checkIn }: { checkIn: CheckInContext }) {
  const scores = [
    checkIn.fatigue != null && `fatigue ${checkIn.fatigue}`,
    checkIn.soreness != null && `soreness ${checkIn.soreness}`,
    checkIn.sleep != null && `sleep ${checkIn.sleep}`,
    checkIn.motivation != null && `motivation ${checkIn.motivation}`,
  ].filter(Boolean) as string[];

  return (
    <div
      className={`mt-5 rounded-xs border p-4 ${
        checkIn.attention === 'attention' ? 'border-status-missed/40' : 'border-hairline'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="im-micro">Their check-in · week of {formatDayMonth(checkIn.weekStart)}</p>
        {checkIn.attention !== 'none' && (
          <Badge tone={checkIn.attention === 'attention' ? 'neutral' : 'neutral'}>
            {checkIn.attention === 'attention' ? 'Needs a look' : 'Watch'}
          </Badge>
        )}
      </div>

      {scores.length > 0 && (
        <p className="mt-2 im-mono text-[11px] text-ink-secondary">{scores.join(' · ')}</p>
      )}
      {checkIn.painOrNiggles && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-body">
          <span className="text-ink-tertiary">Niggles:</span> {checkIn.painOrNiggles}
        </p>
      )}
      {checkIn.feltDifficult && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-body">
          <span className="text-ink-tertiary">Found hard:</span> {checkIn.feltDifficult}
        </p>
      )}
      {checkIn.reasons.length > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-tertiary">
          {checkIn.reasons.join(' · ')}
        </p>
      )}
    </div>
  );
}
