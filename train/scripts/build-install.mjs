/**
 * Rebuild supabase/install/install.sql from the migrations.
 *
 * Supabase's SQL Editor is a paste box, and twenty paste-and-run cycles is
 * twenty chances to skip one or run them out of order. This flattens them
 * into a single transaction so setting up a project is one operation.
 *
 * The migrations stay the source of truth. This file is generated, and
 * install-fresh.test.ts fails if it has drifted — so it cannot quietly rot.
 *
 *   node scripts/build-install.mjs          writes the file
 *   node scripts/build-install.mjs --check  exits non-zero if stale
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
export const INSTALL = join(ROOT, 'supabase', 'install', 'install.sql');

export function build() {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const head = `-- ============================================================
-- IRON MILES TRAINING — full database install
--
-- Every migration, in order, in one file. Paste the whole thing into the
-- Supabase SQL Editor and press Run once.
--
-- GENERATED from the ${files.length} files in supabase/migrations/, which remain the
-- source of truth. Rebuild with \`npm run db:install\`; a test fails if this
-- has drifted from them. It lives outside migrations/ on purpose — the PGlite
-- harness applies every .sql in that folder, and a combined copy there would
-- run the whole schema twice.
--
-- One transaction: if any statement fails, nothing is left behind, so a
-- failed run can be fixed and repeated on the same project.
-- ============================================================

begin;
`;
  const body = files
    .map((f) => `\n-- ======================= ${f} =======================\n\n`
      + readFileSync(join(MIGRATIONS, f), 'utf8').trimEnd() + '\n')
    .join('');
  return head + body + '\ncommit;\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = build();
  if (process.argv.includes('--check')) {
    const now = readFileSync(INSTALL, 'utf8');
    if (now !== next) {
      console.error('install.sql is stale — run: npm run db:install');
      process.exit(1);
    }
    console.log('install.sql is current');
  } else {
    writeFileSync(INSTALL, next);
    console.log(`wrote ${INSTALL}`);
  }
}
