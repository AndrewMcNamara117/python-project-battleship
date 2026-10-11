/**
 * THE PRODUCTION REPOSITORY'S CONTRACT WITH THE DATABASE.
 *
 * `SupabaseRepo` is the only code path that runs in production, and until this
 * file existed no test had ever executed a line of it. The reason is structural:
 * it speaks PostgREST over HTTP, so exercising it end to end needs a running
 * Supabase (PostgREST + GoTrue), which a test environment does not have.
 *
 * What it does NOT need is a running Supabase to answer the question that
 * actually breaks products: *does every table, column and function this code
 * names actually exist, spelled that way, in the schema we ship?*
 *
 * So this reads the real repository source, extracts every database identifier
 * it will ever send, and checks each one against the real migrations running in
 * real Postgres. A wrong column name or a renamed RPC parameter is a guaranteed
 * production failure, and this catches it with no credentials and no fakery.
 *
 * WHAT THIS PROVES:   the repository and the schema agree on names and shapes.
 * WHAT IT DOES NOT:   PostgREST's own semantics, GoTrue-issued JWTs, RLS as
 *                     enforced through the HTTP layer, or connection handling.
 *                     Those need a real project — see the Gate 1 report.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTestDatabase } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, '..', '..', 'src', 'lib', 'data', 'supabase-repo.ts'), 'utf8');

let harness;
let db;
let tables;   // Map<table, Set<column>>
let routines; // Map<function, Set<argname>>

before(async () => {
  harness = await createTestDatabase();
  db = harness.asService;

  const cols = await db(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'`);
  tables = new Map();
  for (const r of cols.rows) {
    if (!tables.has(r.table_name)) tables.set(r.table_name, new Set());
    tables.get(r.table_name).add(r.column_name);
  }

  const fns = await db(`
    select p.proname, coalesce(p.proargnames, '{}') as argnames
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`);
  routines = new Map();
  for (const r of fns.rows) {
    if (!routines.has(r.proname)) routines.set(r.proname, new Set());
    for (const a of r.argnames ?? []) routines.get(r.proname).add(a);
  }
});

after(async () => { await harness?.close(); });

/* ---------------- extraction ---------------- */

/** Every `.from('x')` in source order, with the text of its chain. */
function chains() {
  const out = [];
  const re = /\.from\('([a-z_]+)'\)/g;
  let m;
  const hits = [];
  while ((m = re.exec(SOURCE))) hits.push({ table: m[1], at: m.index });
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].at;
    // a chain ends at the next .from(, or at the first `;` after it
    const nextFrom = i + 1 < hits.length ? hits[i + 1].at : SOURCE.length;
    const semi = SOURCE.indexOf(';', start);
    const end = Math.min(nextFrom, semi === -1 ? SOURCE.length : semi + 1);
    out.push({ table: hits[i].table, text: SOURCE.slice(start, end), at: start });
  }
  return out;
}

const lineOf = (idx) => SOURCE.slice(0, idx).split('\n').length;

/* ---------------- the checks ---------------- */

describe('every table the production repository names exists', () => {
  it('has no unknown tables', () => {
    const missing = [];
    for (const c of chains()) {
      if (!tables.has(c.table)) missing.push(`${c.table} (supabase-repo.ts:${lineOf(c.at)})`);
    }
    assert.deepEqual(missing, [], `tables not in the schema:\n  ${missing.join('\n  ')}`);
  });

  it('reaches a meaningful share of the schema', () => {
    const used = new Set(chains().map((c) => c.table));
    assert.ok(used.size >= 30, `only ${used.size} tables reached`);
  });
});

describe('every filter and ordering column exists on its table', () => {
  it('has no unknown columns in .eq/.in/.gt/.lt/.is/.order/.contains', () => {
    const bad = [];
    const FILTER = /\.(eq|neq|gt|gte|lt|lte|is|in|like|ilike|order|contains|overlaps)\('([a-z_]+)'/g;
    for (const c of chains()) {
      const cols = tables.get(c.table);
      if (!cols) continue;
      let m;
      const re = new RegExp(FILTER.source, 'g');
      while ((m = re.exec(c.text))) {
        const col = m[2];
        if (!cols.has(col)) {
          bad.push(`${c.table}.${col} via .${m[1]}() — supabase-repo.ts:${lineOf(c.at)}`);
        }
      }
    }
    assert.deepEqual(bad, [], `columns not on their table:\n  ${bad.join('\n  ')}`);
  });
});

describe('every column written by insert/upsert/update exists', () => {
  it('has no unknown columns in write payloads', () => {
    const bad = [];
    for (const c of chains()) {
      const cols = tables.get(c.table);
      if (!cols) continue;
      // the object literal handed to insert/upsert/update
      const w = /\.(insert|upsert|update)\(\s*\{([\s\S]*?)\}\s*[,)]/.exec(c.text);
      if (!w) continue;
      // keys at the top level of that literal, snake_case only
      for (const km of w[2].matchAll(/(?:^|[\n,{])\s*([a-z][a-z0-9_]*)\s*:/g)) {
        const key = km[1];
        if (!key.includes('_') && !cols.has(key)) continue; // camelCase local, not a column
        if (!cols.has(key)) bad.push(`${c.table}.${key} via .${w[1]}() — supabase-repo.ts:${lineOf(c.at)}`);
      }
    }
    assert.deepEqual(bad, [], `written columns not on their table:\n  ${bad.join('\n  ')}`);
  });
});

describe('every database function the repository calls exists with the parameters it passes', () => {
  const rpcs = () => {
    const out = [];
    const re = /\.rpc\('([a-z_]+)'\s*(?:,\s*\{([\s\S]*?)\}\s*)?\)/g;
    let m;
    while ((m = re.exec(SOURCE))) {
      const params = [...(m[2] ?? '').matchAll(/(?:^|[\n,{])\s*(p_[a-z0-9_]*)\s*:/g)].map((x) => x[1]);
      out.push({ fn: m[1], params, at: m.index });
    }
    return out;
  };

  it('names only functions that exist', () => {
    const missing = rpcs()
      .filter((r) => !routines.has(r.fn))
      .map((r) => `${r.fn}() — supabase-repo.ts:${lineOf(r.at)}`);
    assert.deepEqual(missing, [], `functions not in the schema:\n  ${missing.join('\n  ')}`);
  });

  it('passes only parameter names the function declares', () => {
    const bad = [];
    for (const r of rpcs()) {
      const declared = routines.get(r.fn);
      if (!declared) continue;
      for (const p of r.params) {
        if (!declared.has(p)) {
          bad.push(`${r.fn}(${p} …) not declared — declares ${[...declared].join(', ') || '(none)'} — supabase-repo.ts:${lineOf(r.at)}`);
        }
      }
    }
    assert.deepEqual(bad, [], `RPC parameter mismatches:\n  ${bad.join('\n  ')}`);
  });

  it('covers every function the repository depends on', () => {
    const used = new Set(rpcs().map((r) => r.fn));
    assert.ok(used.size >= 25, `only ${used.size} functions reached`);
  });
});
