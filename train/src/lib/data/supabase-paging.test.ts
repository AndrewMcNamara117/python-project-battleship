import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepo } from './supabase-repo.ts';

/**
 * PostgREST stops at max-rows without an error. A fake that does the same
 * proves the reads that must be complete page past it.
 */
function fakeDb(rows: Record<string, unknown>[], maxRows = 1000) {
  const ranges: [number, number][] = [];
  const builder = () => {
    let range: [number, number] = [0, Infinity];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a stand-in for the query builder
    const b: any = {
      select: () => b,
      eq: () => b,
      in: () => b,
      gte: () => b,
      order: () => b,
      limit: () => b,
      range: (from: number, to: number) => {
        range = [from, to];
        ranges.push(range);
        return b;
      },
      then: (resolve: (v: unknown) => void) => {
        const [from, to] = range;
        resolve({ data: rows.slice(from, Math.min(to + 1, from + maxRows)), error: null });
      },
    };
    return b;
  };
  return { db: { from: builder } as unknown as SupabaseClient, ranges };
}

const effort = (i: number) => ({ id: `e${i}`, segment_id: 's', activity_id: `a${i}`, athlete_id: 'x', started_at: '2026-01-01', elapsed_s: 300 + i });

describe('reads that must be complete', () => {
  it('every effort, past max-rows: a personal best is a minimum over all of them', async () => {
    const { db, ranges } = fakeDb(Array.from({ length: 2345 }, (_, i) => effort(i)));
    const all = await new SupabaseRepo(db).listEfforts('x');
    assert.equal(all.length, 2345);
    assert.ok(ranges.length >= 5);
  });

  it('a bounded list stops at its limit', async () => {
    const { db } = fakeDb(Array.from({ length: 2345 }, (_, i) => effort(i)));
    const repo = new SupabaseRepo(db);
    // listActivities maps rows; only the count matters here
    const some = await repo.listActivities('x', 60);
    assert.equal(some.length, 60);
  });
});
