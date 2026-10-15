import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from '@/lib/data/demo-repo';
import { syntheticRun, toFit } from '@/lib/activity/fixtures';
import { decryptTokens, encryptTokens, hmacHex, signState, verifyState } from './crypto.ts';
import { finishConnect, handlePush } from './pipeline.ts';
import type { PushedActivity, SyncProvider, SyncTokens } from './provider.ts';

const SECRET = 'a'.repeat(40);
const PUSH_SECRET = 'push-secret';
beforeEach(() => resetDemoData());

describe('state', () => {
  it('round-trips for the athlete and provider that started it', () => {
    const s = signState(SECRET, 'ath-1', 'garmin');
    assert.deepEqual(verifyState(SECRET, s, { athleteId: 'ath-1', provider: 'garmin' }), { ok: true });
  });
  it('refuses another athlete, another provider, a tampered or an old state', () => {
    const s = signState(SECRET, 'ath-1', 'garmin');
    assert.equal(verifyState(SECRET, s, { athleteId: 'ath-2', provider: 'garmin' }).ok, false);
    assert.equal(verifyState(SECRET, s, { athleteId: 'ath-1', provider: 'coros' }).ok, false);
    const [p, m] = s.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), athleteId: 'ath-2' })).toString('base64url');
    assert.equal(verifyState(SECRET, `${forged}.${m}`, { athleteId: 'ath-2', provider: 'garmin' }).ok, false);
    assert.equal(verifyState(SECRET, s, { athleteId: 'ath-1', provider: 'garmin' }, Date.now() + 11 * 60_000).ok, false);
    assert.equal(verifyState('b'.repeat(40), s, { athleteId: 'ath-1', provider: 'garmin' }).ok, false);
    assert.equal(verifyState(SECRET, null, { athleteId: 'ath-1', provider: 'garmin' }).ok, false);
  });
});

describe('sealed tokens', () => {
  it('round-trip, and are not the plain token', () => {
    const sealed = encryptTokens(SECRET, { accessToken: 'tok-123' });
    assert.ok(!sealed.includes('tok-123'));
    assert.deepEqual(decryptTokens(SECRET, sealed), { accessToken: 'tok-123' });
  });
  it('refuse a tampered ciphertext or the wrong key', () => {
    const sealed = encryptTokens(SECRET, { accessToken: 'tok-123' });
    const parts = sealed.split('.');
    parts[3] = Buffer.from('x' + Buffer.from(parts[3], 'base64url').toString('binary').slice(1), 'binary').toString('base64url');
    assert.throws(() => decryptTokens(SECRET, parts.join('.')));
    assert.throws(() => decryptTokens('c'.repeat(40), sealed));
  });
});

/** A provider in memory: files by ref, tokens that can expire, a fetch that can fail once. */
function fakeProvider(opts: { failFirstFetch?: boolean; expiresAt?: string | null } = {}) {
  const files = new Map<string, Uint8Array>();
  let fetches = 0;
  let refreshes = 0;
  const provider: SyncProvider = {
    name: 'garmin',
    label: 'Garmin Connect',
    configured: () => true,
    setupRequired: null,
    authorizeUrl: (state) => `https://provider.test/authorize?state=${state}`,
    exchangeCode: async (code) => {
      if (code !== 'good-code') throw new Error('bad code');
      return { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: opts.expiresAt ?? null, externalUserId: 'garmin-user-7' };
    },
    refresh: async (t: SyncTokens) => {
      refreshes++;
      return { ...t, accessToken: `access-${refreshes + 1}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    },
    verifyPush: (raw, headers) => (headers.get('x-sync-signature') === hmacHex(PUSH_SECRET, raw) ? { ok: true } : { ok: false, reason: 'bad sig' }),
    readPush: (p) => {
      const x = p as { user_id: string; activities: { id: string; ref: string }[] };
      return { externalUserId: x.user_id, activities: x.activities.map((a) => ({ externalId: a.id, ref: a.ref })) };
    },
    fetchFile: async (t: SyncTokens, a: PushedActivity) => {
      fetches++;
      if (opts.failFirstFetch && fetches === 1) throw new Error('provider 502');
      if (!t.accessToken.startsWith('access-')) throw new Error('unauthorised');
      const f = files.get(a.ref);
      if (!f) throw new Error('404');
      return f;
    },
  };
  return { provider, files, stats: () => ({ fetches, refreshes }) };
}

const signed = (body: unknown) => {
  const raw = JSON.stringify(body);
  return { raw, headers: new Headers({ 'x-sync-signature': hmacHex(PUSH_SECRET, raw) }) };
};
const run = (daysAhead: number) =>
  toFit(syntheticRun({ start: new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10) + 'T07:00:00Z', distanceKm: 6, paceSecPerKm: 310, intervalS: 2 }));

async function connected(f: ReturnType<typeof fakeProvider>) {
  const repo = new DemoRepo();
  const out = await finishConnect({
    provider: f.provider, secret: SECRET, athleteId: DEMO_ATHLETE_ID, code: 'good-code',
    state: signState(SECRET, DEMO_ATHLETE_ID, 'garmin'), redirectUri: 'https://app.test/cb', service: repo,
  });
  assert.deepEqual(out, { ok: true });
  return repo;
}

describe('connecting', () => {
  it('stores the tokens sealed and marks the integration connected', async () => {
    const repo = await connected(fakeProvider());
    const c = await repo.getConnection(DEMO_ATHLETE_ID, 'garmin');
    assert.ok(c && c.sealedTokens.startsWith('v1.') && !c.sealedTokens.includes('access-1'));
    assert.equal(decryptTokens<SyncTokens>(SECRET, c.sealedTokens).accessToken, 'access-1');
    assert.equal((await repo.listIntegrations(DEMO_ATHLETE_ID)).find((i) => i.provider === 'garmin')?.status, 'connected');
  });

  it('refuses a state from someone else, and a refused code', async () => {
    const repo = new DemoRepo();
    const f = fakeProvider();
    const stolen = await finishConnect({ provider: f.provider, secret: SECRET, athleteId: DEMO_ATHLETE_ID, code: 'good-code', state: signState(SECRET, 'someone-else', 'garmin'), redirectUri: 'x', service: repo });
    assert.equal(stolen.ok, false);
    const refused = await finishConnect({ provider: f.provider, secret: SECRET, athleteId: DEMO_ATHLETE_ID, code: 'bad', state: signState(SECRET, DEMO_ATHLETE_ID, 'garmin'), redirectUri: 'x', service: repo });
    assert.equal(refused.ok, false);
    assert.equal(await repo.getConnection(DEMO_ATHLETE_ID, 'garmin'), null);
  });

  it('one watch account belongs to one athlete', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    const other = await finishConnect({ provider: f.provider, secret: SECRET, athleteId: 'demo-athlete-2', code: 'good-code', state: signState(SECRET, 'demo-athlete-2', 'garmin'), redirectUri: 'x', service: repo });
    assert.equal(other.ok, false);
  });
});

describe('a push', () => {
  it('imports the activity as the athlete’s, from the provider', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    f.files.set('r1', run(300));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'a1', ref: 'r1' }] });
    const report = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.deepEqual([report.status, report.imported], [200, 1]);
    const [latest] = await repo.listActivities(DEMO_ATHLETE_ID, 1);
    assert.equal(latest.source, 'garmin');
    assert.ok((await repo.listIntegrations(DEMO_ATHLETE_ID)).find((i) => i.provider === 'garmin')?.lastSyncAt);
  });

  it('refuses an unsigned or forged push', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    const { raw } = signed({ user_id: 'garmin-user-7', activities: [] });
    const r = await handlePush({ provider: f.provider, secret: SECRET, raw, headers: new Headers({ 'x-sync-signature': 'beef' }), service: repo });
    assert.equal(r.status, 401);
  });

  it('a push for an unknown account is acknowledged and does nothing', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    const { raw, headers } = signed({ user_id: 'stranger', activities: [{ id: 'a9', ref: 'r9' }] });
    const r = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.deepEqual([r.status, r.imported, f.stats().fetches], [200, 0, 0]);
  });

  it('the same push twice imports once', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    f.files.set('r1', run(301));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'a1', ref: 'r1' }] });
    await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    const again = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.deepEqual([again.imported, again.duplicates, f.stats().fetches], [0, 1, 1]);
  });

  it('a fetch that failed is fetched again when the provider retries', async () => {
    const f = fakeProvider({ failFirstFetch: true });
    const repo = await connected(f);
    f.files.set('r1', run(302));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'a1', ref: 'r1' }] });
    const first = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.equal(first.failed, 1);
    const retry = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.equal(retry.imported, 1);
  });

  it('expired tokens are refreshed, and the new ones stored sealed', async () => {
    const f = fakeProvider({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const repo = await connected(f);
    f.files.set('r1', run(303));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'a1', ref: 'r1' }] });
    const r = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.equal(r.imported, 1);
    assert.equal(f.stats().refreshes, 1);
    const sealed = (await repo.getConnection(DEMO_ATHLETE_ID, 'garmin'))!.sealedTokens;
    assert.equal(decryptTokens<SyncTokens>(SECRET, sealed).accessToken, 'access-2');
  });

  it('a file that is not an activity is recorded as failed, not thrown', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    f.files.set('junk', new TextEncoder().encode('not a file'));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'j1', ref: 'junk' }] });
    const r = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.deepEqual([r.status, r.failed], [200, 1]);
  });

  it('after disconnecting, pushes do nothing', async () => {
    const f = fakeProvider();
    const repo = await connected(f);
    await repo.removeConnection(DEMO_ATHLETE_ID, 'garmin');
    f.files.set('r1', run(304));
    const { raw, headers } = signed({ user_id: 'garmin-user-7', activities: [{ id: 'a1', ref: 'r1' }] });
    const r = await handlePush({ provider: f.provider, secret: SECRET, raw, headers, service: repo });
    assert.equal(r.imported, 0);
    assert.equal(f.stats().fetches, 0);
  });
});
