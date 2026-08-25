import { hasSupabase } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
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

export function isDemoMode(): boolean {
  return !hasSupabase;
}

export type { IronMilesRepo } from './repo';
