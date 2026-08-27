'use client';

import { useState, useTransition } from 'react';
import { previewBatchAction, runBatchAction } from '@/app/actions/batch';
import { listAssignableTemplates } from '@/app/actions/batch-templates';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import {
  applicableIds, availableActions, BATCH_ACTION_LABEL, confirmLabel,
  resultSentence, tally, tallySentence, unavailableReason,
} from '@/lib/domain/batch';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';
import type {
  BatchAction, BatchParams, BatchPreview, BatchResult,
} from '@/lib/domain/batch';
import type { RosterEntry } from '@/lib/domain/roster';
import { BatchReview } from './BatchReview';

/**
 * ONE COACHING DECISION, APPLIED TO THESE ATHLETES.
 *
 * The shape of this is deliberately the shape of the single-athlete flow a
 * coach already knows: choose what to do, see what it would do, then confirm.
 * The only thing that is new is that "what it would do" is a list of people
 * rather than a list of sessions.
 *
 * Two rules run through it. The coach can always see exactly who is selected,
 * and the confirm button never claims more than the batch will deliver — its
 * number comes from the review, not from the selection.
 */

type Template = Awaited<ReturnType<typeof listAssignableTemplates>>[number];

const PERCENTAGES = [70, 80, 90, 110, 120];
const SHIFTS = [-3, -2, -1, 1, 2, 3, 7];

export function BatchBar({
  selected,
  onClear,
  onRemove,
}: {
  selected: RosterEntry[];
  onClear: () => void;
  onRemove: (athleteId: string) => void;
}) {
  const [action, setAction] = useState<BatchAction | null>(null);
  // the preview carries the selection it was computed for. Changing who is
  // selected does not clear it in an effect — it simply stops matching, so a
  // stale review can never be on screen for even one render.
  const [previewFor, setPreview] = useState<{ key: string; preview: BatchPreview } | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  // next Monday: the honest default for a programme start
  const [startDate, setStartDate] = useState(
    () => addDays(startOfWeek(toISODate(new Date())), 7));
  const [percent, setPercent] = useState(90);
  const [days, setDays] = useState(1);
  const [from, setFrom] = useState(() => startOfWeek(toISODate(new Date())));
  const [to, setTo] = useState(() => addDays(startOfWeek(toISODate(new Date())), 6));

  const ids = selected.map((e) => e.athleteId);
  const offered = availableActions(selected);
  const selectionKey = ids.join(',');
  const preview = previewFor?.key === selectionKey ? previewFor.preview : null;

  // fetched when the coach asks for it rather than on mount: most selections
  // never reach the assignment action
  const chooseAction = (key: BatchAction) => {
    setAction(key);
    setPreview(null);
    setResult(null);
    if (key === 'assign_template' && templates.length === 0) {
      void listAssignableTemplates().then((list) => {
        setTemplates(list);
        if (list.length) setTemplateId((current) => current || list[0].id);
      });
    }
  };

  if (selected.length === 0) return null;

  const params = (): BatchParams | null => {
    if (action === 'assign_template') {
      return templateId ? { action, templateId, startDate } : null;
    }
    if (action === 'scale_volume') return { action, from, to, factor: percent / 100 };
    if (action === 'shift_sessions') return { action, from, to, days };
    return null;
  };

  const review = () => {
    const p = params();
    if (!p) { setError('Choose a programme first.'); return; }
    setError(null);
    start(async () => {
      const res = await previewBatchAction(ids, p);
      if (!res.ok) { setError(res.message); setPreview(null); return; }
      setPreview({ key: selectionKey, preview: res.preview });
    });
  };

  const apply = () => {
    const p = params();
    if (!p || !preview) return;
    // only the athletes the review said would change. The coach approved a
    // number and this is that number, not the selection it came from.
    const targets = applicableIds(preview);
    start(async () => {
      const res = await runBatchAction(targets, p);
      if (!res.ok) { setError(res.message); return; }
      setResult(res.result);
      setPreview(null);
    });
  };

  const t = preview ? tally(preview) : null;

  const expanded = Boolean(preview || result);

  return (
    <div
      className={`im-safe-b z-40 mt-6 border-t border-mint/25 bg-onyx/95 pt-4 backdrop-blur-xl ${
        expanded ? 'pb-8' : 'sticky bottom-0 pb-24 lg:pb-4'
      }`}
      role="region"
      aria-label="Selected athletes"
    >
      {/* who is selected — always visible, never a count on its own */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Badge tone="solid">{selected.length} selected</Badge>

        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selected.slice(0, 8).map((e) => (
            <li key={e.athleteId}>
              <button
                type="button"
                onClick={() => onRemove(e.athleteId)}
                className="rounded-xs border border-hairline-strong px-2 py-1 text-[11px] text-ink-secondary transition-colors hover:border-status-missed hover:text-status-missed"
                aria-label={`Remove ${e.fullName} from the selection`}
              >
                {e.fullName} ×
              </button>
            </li>
          ))}
          {selected.length > 8 && (
            <li className="self-center im-mono text-[11px] text-ink-tertiary">
              and {selected.length - 8} more
            </li>
          )}
        </ul>

        <Button variant="quiet" size="sm" onClick={onClear}>Clear</Button>
      </div>

      {/* what to do with them */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(['assign_template', 'scale_volume', 'shift_sessions'] as BatchAction[]).map((key) => {
          const usable = offered.includes(key);
          const why = unavailableReason(key, selected);
          return (
            <button
              key={key}
              type="button"
              disabled={!usable}
              title={usable ? undefined : why ?? undefined}
              onClick={() => chooseAction(key)}
              aria-pressed={action === key}
              className={`rounded-xs border px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors disabled:opacity-35 ${
                action === key
                  ? 'border-mint bg-mint/10 text-mint'
                  : 'border-hairline-strong text-ink-secondary hover:border-mint hover:text-mint'
              }`}
            >
              {BATCH_ACTION_LABEL[key]}
            </button>
          );
        })}
        {action && !offered.includes(action) && (
          <p className="text-[12px] text-ink-tertiary">{unavailableReason(action, selected)}</p>
        )}
      </div>

      {/* the parameters for the chosen action */}
      {action && offered.includes(action) && !result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            {action === 'assign_template' && (
              <>
                <Field label="Programme">
                  {(p) => (
                    <Select {...p} value={templateId}
                      onChange={(e) => { setTemplateId(e.target.value); setPreview(null); }}>
                      {templates.length === 0 && <option value="">Loading…</option>}
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} — {tpl.weeks} weeks
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Starting">
                  {(p) => (
                    <Input {...p} type="date" value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPreview(null); }} />
                  )}
                </Field>
              </>
            )}

            {action === 'scale_volume' && (
              <>
                <Field label="Prescribed distance" hint="Rest days, completed training and sessions prescribed by time are never touched.">
                  {(p) => (
                    <Select {...p} value={percent}
                      onChange={(e) => { setPercent(Number(e.target.value)); setPreview(null); }}>
                      {PERCENTAGES.map((n) => <option key={n} value={n}>{n}%</option>)}
                    </Select>
                  )}
                </Field>
                <DateRange from={from} to={to}
                  onFrom={(v) => { setFrom(v); setPreview(null); }}
                  onTo={(v) => { setTo(v); setPreview(null); }} />
              </>
            )}

            {action === 'shift_sessions' && (
              <>
                <Field label="Move by" hint="Nothing moves into the past, onto completed training, or outside its programme.">
                  {(p) => (
                    <Select {...p} value={days}
                      onChange={(e) => { setDays(Number(e.target.value)); setPreview(null); }}>
                      {SHIFTS.map((n) => (
                        <option key={n} value={n}>
                          {Math.abs(n)} {Math.abs(n) === 1 ? 'day' : 'days'} {n > 0 ? 'later' : 'earlier'}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <DateRange from={from} to={to}
                  onFrom={(v) => { setFrom(v); setPreview(null); }}
                  onTo={(v) => { setTo(v); setPreview(null); }} />
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={review} disabled={pending}>
              {pending && !preview ? 'Checking…' : 'Review'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] font-bold text-status-missed">{error}</p>
      )}

      {/* the review: one row per athlete, and a button that cannot overstate */}
      {preview && t && (
        <div className="mt-4">
          <div className="max-h-[26rem] overflow-y-auto overscroll-contain">
            <BatchReview preview={preview} onRemove={onRemove} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button onClick={apply} disabled={pending || t.willChange === 0}>
              {pending ? 'Applying…' : confirmLabel(preview.action, t)}
            </Button>
            <p className="text-[12.5px] text-ink-secondary">{tallySentence(t)}</p>
          </div>
        </div>
      )}

      {/* what actually happened, per athlete */}
      {result && (
        <div className="mt-4">
          <p role="status" className="text-[14px] font-semibold text-ink">
            {resultSentence(result)}
          </p>
          <ul className="mt-3 grid gap-1.5">
            {result.rows.map((row) => (
              <li key={row.athleteId} className="flex flex-wrap items-baseline gap-2.5 text-[13px]">
                <span className={`im-mono text-[10px] uppercase tracking-[0.12em] ${
                  row.outcome === 'applied' ? 'text-mint'
                    : row.outcome === 'skipped' ? 'text-ink-tertiary'
                      : 'text-status-missed'}`}>
                  {row.outcome}
                </span>
                <span className="text-ink">{row.athleteName}</span>
                <span className="text-ink-secondary">{row.detail}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setAction(null); }}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateRange({ from, to, onFrom, onTo }: {
  from: string; to: string;
  onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="From">
        {(p) => <Input {...p} type="date" value={from} onChange={(e) => onFrom(e.target.value)} />}
      </Field>
      <Field label="To">
        {(p) => <Input {...p} type="date" value={to} onChange={(e) => onTo(e.target.value)} />}
      </Field>
    </div>
  );
}
