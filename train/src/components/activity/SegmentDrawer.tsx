'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { createSegmentFromActivity, type SegmentResult } from '@/app/actions/segments';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { projectRoute, type LatLon } from '@/lib/activity/route';
import { cutLine } from '@/lib/activity/segments';

/**
 * Draw a segment from this route: two handles along it, a live preview, a
 * name. The handles cannot reach within the clearance of either end.
 */
export function SegmentDrawer({
  activityId,
  line,
  lengthM,
  clearanceM,
}: {
  activityId: string;
  line: LatLon[];
  lengthM: number;
  clearanceM: number;
}) {
  const min = clearanceM;
  const max = Math.max(min, lengthM - clearanceM);
  const [from, setFrom] = useState(Math.round(min));
  const [to, setTo] = useState(Math.round(Math.min(max, min + 1000)));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<SegmentResult | null>(null);
  const [pending, start] = useTransition();

  const W = 420;
  const H = 260;
  // project the whole line and the chosen piece in the same frame
  const preview = useMemo(() => {
    const whole = projectRoute([line], W, H, 14);
    const both = projectRoute([line, cutLine(line, from, to)], W, H, 14);
    return { whole: whole.paths[0], piece: both.paths[1] };
  }, [line, from, to]);

  if (max - min < 200) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-secondary">
        This route is too short to draw a segment from once {clearanceM} m is kept clear of each end.
      </p>
    );
  }

  const km = (m: number) => (m / 1000).toFixed(2);

  return (
    <form
      className="space-y-5"
      action={() =>
        start(async () => {
          setResult(await createSegmentFromActivity(activityId, from, to, name, description));
        })
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-xs bg-onyx" role="img" aria-label={`Segment preview: ${km(from)} km to ${km(to)} km along the route`}>
        <path d={preview.whole} stroke="var(--color-steel)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={preview.piece} stroke="var(--color-mint)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="im-micro">Starts at {km(from)} km</span>
          <input
            type="range"
            min={min}
            max={max}
            step={10}
            value={from}
            onChange={(e) => setFrom(Math.min(Number(e.target.value), to - 200))}
            className="mt-2 w-full accent-[var(--color-mint)]"
          />
        </label>
        <label className="block">
          <span className="im-micro">Ends at {km(to)} km</span>
          <input
            type="range"
            min={min}
            max={max}
            step={10}
            value={to}
            onChange={(e) => setTo(Math.max(Number(e.target.value), from + 200))}
            className="mt-2 w-full accent-[var(--color-mint)]"
          />
        </label>
      </div>
      <p className="text-[12px] text-ink-tertiary">
        {((to - from) / 1000).toFixed(2)} km. The ends of the route are out of reach on purpose: a segment is public, and
        the ends are nearest the athlete’s home.
      </p>

      <Field label="Name">{(p) => <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Canal bank drag" {...p} />}</Field>
      <Field label="Description (optional)">
        {(p) => <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Where it starts and finishes, what to watch for" {...p} />}
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          {pending ? 'Drawing…' : 'Draw segment'}
        </Button>
        {result && (
          <p role="status" className={`text-[13px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}>
            {result.message}{' '}
            {result.segmentId && (
              <Link href="/coach/segments" className="underline">
                All segments
              </Link>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
