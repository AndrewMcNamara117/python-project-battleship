/**
 * THE FILE A HUMAN ACTUALLY PASTES.
 *
 * Setting up a Supabase project means pasting supabase/install/install.sql
 * into the SQL Editor once. Nothing else in this suite covers that file, so
 * two things could go wrong silently: it drifts from the migrations it was
 * generated from, or it fails to apply to an empty project.
 *
 * Both are checked here against real Postgres, and the second check asserts
 * the result is the same database the migrations produce — not merely that
 * it ran without error.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { build, INSTALL } from '../../scripts/build-install.mjs';

/** Only what Supabase itself provides. The install file may assume nothing more. */
const SUPABASE_PROVIDES = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now());
  create or replace function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
      (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'),'authenticated') $$;
  do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated')
    then create role authenticated nologin; end if; end $$;`;

const SHAPE = {
  columns: `select table_name||'.'||column_name||':'||data_type||':'||is_nullable t
            from information_schema.columns where table_schema='public' order by 1`,
  policies: `select tablename||'|'||policyname||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') t
             from pg_policies where schemaname='public' order by 1`,
  functions: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' t
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`,
  constraints: `select conrelid::regclass||'|'||conname||'|'||pg_get_constraintdef(oid) t
                from pg_constraint where connamespace='public'::regnamespace order by 1`,
  indexes: `select indexdef t from pg_indexes where schemaname='public' order by 1`,
  enums: `select t.typname||':'||e.enumlabel t from pg_type t join pg_enum e on e.enumtypid=t.oid order by 1`,
  triggers: `select tgrelid::regclass||'|'||tgname t from pg_trigger where not tgisinternal order by 1`,
};

async function shapeOf(apply) {
  const db = new PGlite();
  await db.exec(SUPABASE_PROVIDES);
  await apply(db);
  const out = {};
  for (const [k, sql] of Object.entries(SHAPE)) out[k] = (await db.query(sql)).rows.map((r) => r.t);
  const open = (await db.query(
    `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1`)).rows.map((r) => r.relname);
  await db.close();
  return { ...out, withoutRls: open };
}

describe('the one-paste install file', () => {
  it('has not drifted from the migrations', () => {
    assert.equal(readFileSync(INSTALL, 'utf8'), build(),
      'install.sql is stale — run: npm run db:install');
  });

  it('applies to an empty project and builds the same database as the migrations', async () => {
    const stepwise = await shapeOf(async (db) => {
      const dir = new URL('../migrations/', import.meta.url);
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
        await db.exec(readFileSync(new URL(f, dir), 'utf8'));
      }
    });
    const combined = await shapeOf((db) => db.exec(readFileSync(INSTALL, 'utf8')));

    for (const key of Object.keys(SHAPE)) {
      assert.deepEqual(combined[key], stepwise[key], `${key} differ between install.sql and the migrations`);
    }
    // Belt and braces: the thing a coach's athletes depend on.
    assert.deepEqual(combined.withoutRls, [], 'tables left without row-level security');
    assert.ok(combined.policies.length > 80, `only ${combined.policies.length} policies`);
  });
});
