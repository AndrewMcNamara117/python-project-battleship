'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Badge, Dot } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardScope } from '@/lib/domain/types';

const SCOPES: { value: LeaderboardScope; label: string }[] = [
  { value: 'weekly', label: 'This week' },
  { value: 'monthly', label: 'This month' },
  { value: 'all_time', label: 'All time' },
];

const CATEGORIES: { value: LeaderboardCategory; label: string; unit: string; blurb: string }[] = [
  { value: 'forge_score', label: 'Forge Score', unit: 'pts', blurb: 'Prescribed sessions, check-ins and showing up.' },
  { value: 'consistency', label: 'Consistency', unit: 'weeks', blurb: 'Weeks with training logged. The one that actually matters.' },
  { value: 'community', label: 'Community', unit: 'events', blurb: 'Club runs attended and events volunteered at.' },
  { value: 'streaks', label: 'Streaks', unit: 'weeks', blurb: 'Consecutive weeks without a gap.' },
];

export function LeaderboardTabs({
  boards,
  meId,
  optedIn,
}: {
  boards: Record<string, LeaderboardEntry[]>;
  meId: string;
  optedIn: boolean;
}) {
  const [scope, setScope] = useState<LeaderboardScope>('monthly');
  const [category, setCategory] = useState<LeaderboardCategory>('forge_score');
  const reduced = useReducedMotion();

  const rows = boards[`${scope}:${category}`] ?? [];
  const meta = CATEGORIES.find((c) => c.value === category)!;

  return (
    <div>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="im-micro">Period</p>
          <div role="tablist" aria-label="Leaderboard period" className="mt-2.5 flex gap-1">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                role="tab"
                aria-selected={scope === s.value}
                onClick={() => setScope(s.value)}
                className={`rounded-xs border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  scope === s.value ? 'border-green bg-green/10 text-white' : 'border-line-2 text-muted hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="im-micro">Category</p>
          <div role="tablist" aria-label="Leaderboard category" className="mt-2.5 flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                role="tab"
                aria-selected={category === c.value}
                onClick={() => setCategory(c.value)}
                className={`rounded-xs border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  category === c.value
                    ? 'border-green bg-green/10 text-white'
                    : 'border-line-2 text-muted hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-[13px] text-muted">{meta.blurb}</p>

      {!optedIn && (
        <Panel className="mt-6 border-warn/35 bg-warn/6 p-5">
          <p className="im-micro text-warn">You are not listed</p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-white">
            Leaderboard visibility is off by default. Turn it on in your profile to appear here —
            only your name and score are ever shown, never your training or check-in data.
          </p>
        </Panel>
      )}

      <Panel className="mt-6 overflow-hidden p-0">
        <ol>
          {rows.map((row) => {
            const isMe = row.athleteId === meId;
            return (
              <motion.li
                key={row.athleteId}
                layout={!reduced}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:px-6 ${
                  isMe ? 'bg-green/6' : ''
                }`}
              >
                <span
                  className={`im-mono w-8 shrink-0 text-[13px] font-bold ${
                    row.rank <= 3 ? 'text-green' : 'text-muted-2'
                  }`}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{row.displayName}</span>
                  {row.group && <span className="im-micro mt-1 block">{row.group}</span>}
                </span>
                {isMe && <Dot />}
                <span className="im-mono shrink-0 text-[15px] font-extrabold text-green">
                  {row.value}
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">
                    {meta.unit}
                  </span>
                </span>
              </motion.li>
            );
          })}
          {!rows.length && (
            <li className="px-6 py-8">
              <p className="text-[14px] text-muted">
                Nobody has opted in to this board yet. Yours would be the first.
              </p>
            </li>
          )}
        </ol>
      </Panel>

      <p className="mt-5 text-[11px] leading-relaxed text-muted-2">
        Forge Score rewards completing what was prescribed, weekly consistency, strength sessions,
        check-ins and turning up for the club. Running further than you were asked to earns nothing —
        a leaderboard that rewarded raw volume would be a leaderboard that rewarded overtraining.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Opt-in only</Badge>
        <Badge tone="neutral">No health data shown</Badge>
        <Badge tone="neutral">No pace or distance shown</Badge>
      </div>
    </div>
  );
}
