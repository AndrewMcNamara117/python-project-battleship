import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');

/**
 * Runs the real migrations against a real Postgres (PGlite is Postgres compiled
 * to WASM), with a shim for the parts Supabase provides: the `auth` schema,
 * `auth.users`, and `auth.uid()`.
 *
 * Why this matters: row-level security is the enforcement boundary for this
 * product. Reasoning about a policy is not the same as running it. Everything
 * here executes the same SQL that ships.
 */

// Supabase's auth schema, reduced to what the policies actually depend on.
const AUTH_SHIM = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id                  uuid primary key default gen_random_uuid(),
    email               text unique not null,
    raw_user_meta_data  jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
  );

  -- Supabase reads the subject claim from the request JWT. Locally we set the
  -- same GUC directly, which is how the policies see "who is asking".
  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
  $$;
`;

// The role the application connects as. Not a superuser, so RLS applies —
// a superuser would bypass every policy and the whole test would prove nothing.
const APP_ROLE = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;

  grant usage on schema public, auth to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on auth.users to authenticated;
  grant execute on all functions in schema public to authenticated;
  grant execute on all functions in schema auth to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
`;

export async function createTestDatabase({ verbose = false } = {}) {
  const db = new PGlite();

  const run = async (sql, label) => {
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`${label} failed: ${error.message}`);
    }
  };

  await run(AUTH_SHIM, 'auth shim');

  // every migration, in order, read from disk — so a new one is never missed
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    await run(sql, file);
    if (verbose) console.log(`  applied ${file}`);
  }

  await run(APP_ROLE, 'app role');

  /** Run a query as a specific signed-in user, under RLS. */
  const asUser = async (userId, sql, params = []) => {
    await db.exec(`set role authenticated;`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec('reset role;');
    }
  };

  /**
   * Run as the service role (migrations, webhooks, cron) — bypasses RLS.
   *
   * The identity GUC is cleared first. asUser sets it at session scope, so
   * without this the service role keeps whichever user acted last, and
   * anything reading auth.uid() — guard triggers, audit attribution — sees a
   * stale identity instead of no identity.
   */
  const asService = async (sql, params = []) => {
    await db.exec('reset role;');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    return await db.query(sql, params);
  };

  /**
   * Assert a write or function call is actually refused — it must raise.
   *
   * Deliberately strict: an INSERT or UPDATE without RETURNING reports zero
   * rows whether it succeeded or not, so treating "no rows" as refusal would
   * let a permissive policy pass this suite silently. Visibility of a SELECT is
   * asserted directly at the call site instead.
   */
  const expectRefused = async (userId, sql, params = []) => {
    try {
      await asUser(userId, sql, params);
      return null;
    } catch (error) {
      return error.message;
    }
  };

  /** Create an auth user, which fires the profile + intake trigger. */
  const signUp = async (email, fullName = '') => {
    const { rows } = await asService(
      `insert into auth.users (email, raw_user_meta_data)
       values ($1, jsonb_build_object('full_name', $2::text))
       returning id`,
      [email, fullName],
    );
    return rows[0].id;
  };

  const setRole = async (userId, role) =>
    asService(`update profiles set role = $2 where id = $1`, [userId, role]);

  return { db, asUser, asService, expectRefused, signUp, setRole, close: () => db.close() };
}
