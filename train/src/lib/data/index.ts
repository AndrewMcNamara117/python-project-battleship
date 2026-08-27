import { hasSupabase } from '@/lib/env';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import { DemoRepo } from './demo-repo';
import { SupabaseRepo } from './supabase-repo';
import type { IronMilesRepo } from './repo';

const demo = new DemoRepo();

/**
 * The application's only entry point to data.
 *
 * Selection is by environment, never by user input: if Supabase credentials
 * are present every read and write goes to Postgres under RLS, otherwise the
 * in-memory demo dataset serves the same interface so the product is fully
 * explorable before a database exists.
 */
export async function getRepo(): Promise<IronMilesRepo> {
  if (!hasSupabase) return demo;
  const supabase = await createServerSupabase();
  return new SupabaseRepo(supabase);
}

/**
 * The repo as the server itself, with no signed-in user.
 *
 * Scheduled jobs have no session to borrow, so they connect as the service
 * role. That role bypasses RLS, which is exactly why its use is confined to
 * this one function and the three notification jobs: everything a job writes
 * still goes through `im_notify`, which re-checks that the athlete is on that
 * coach's roster before a word reaches anyone.
 *
 * Without a database the demo repo answers instead and the caller is told it
 * is a dry run — so the job logic is exercised rather than skipped.
 */
export async function getServiceRepo(): Promise<{ repo: IronMilesRepo; dryRun: boolean }> {
  if (!hasSupabase) return { repo: demo, dryRun: true };
  return { repo: new SupabaseRepo(createAdminSupabase()), dryRun: false };
}

export function isDemoMode(): boolean {
  return !hasSupabase;
}

export type { IronMilesRepo } from './repo';
