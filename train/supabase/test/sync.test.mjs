import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/** Watch-sync tables (migration 0028): tokens readable by no client at all. */

let t;
let coach, athlete, other, admin;

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  other = await t.signUp('other@example.com', 'Other');
  admin = await t.signUp('admin@ironmiles.ie', 'Admin');
  await t.setRole(coach, 'coach');
  await t.setRole(admin, 'admin');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, athlete]);
  await t.asService(
    `insert into integration_secrets (athlete_id, provider, external_user_id, token_ciphertext) values ($1, 'garmin', 'g-7', 'v1.iv.tag.data')`,
    [athlete],
  );
  await t.asService(`insert into integrations (athlete_id, provider, status) values ($1, 'garmin', 'connected')`, [athlete]);
});

after(async () => t?.close());

describe('integration_secrets', () => {
  for (const [who, label] of [['athlete', 'the athlete themselves'], ['coach', 'their coach'], ['admin', 'an admin'], ['other', 'another member']]) {
    it(`${label} cannot read the tokens`, async () => {
      const id = { athlete, coach, admin, other }[who];
      const { rows } = await t.asUser(id, 'select token_ciphertext from integration_secrets');
      assert.equal(rows.length, 0);
    });
  }

  it('nor write them', async () => {
    assert.ok(await t.expectRefused(athlete, `insert into integration_secrets (athlete_id, provider, external_user_id, token_ciphertext) values ($1, 'coros', 'c-1', 'v1.a.b.c')`, [athlete]));
    await t.asUser(athlete, `update integration_secrets set external_user_id = 'hijack' where athlete_id = $1`, [athlete]);
    const { rows } = await t.asService('select external_user_id from integration_secrets where athlete_id = $1', [athlete]);
    assert.equal(rows[0].external_user_id, 'g-7');
  });

  it('only sealed values are accepted, even from the server', async () => {
    const refused = await t.asService(
      `insert into integration_secrets (athlete_id, provider, external_user_id, token_ciphertext) values ($1, 'coros', 'c-2', 'plain-token')`,
      [other],
    ).then(() => null, (e) => e.message);
    assert.match(refused ?? '', /check/);
  });

  it('one watch account, one athlete', async () => {
    const refused = await t.asService(
      `insert into integration_secrets (athlete_id, provider, external_user_id, token_ciphertext) values ($1, 'garmin', 'g-7', 'v1.x')`,
      [other],
    ).then(() => null, (e) => e.message);
    assert.match(refused ?? '', /unique|duplicate/);
  });

  it('deleting the athlete deletes their tokens', async () => {
    const leaving = await t.signUp('leaving@example.com', 'Leaving');
    await t.asService(`insert into integration_secrets (athlete_id, provider, external_user_id, token_ciphertext) values ($1, 'coros', 'c-9', 'v1.x')`, [leaving]);
    await t.asService('delete from auth.users where id = $1', [leaving]);
    const { rows } = await t.asService('select count(*)::int as n from integration_secrets where athlete_id = $1', [leaving]);
    assert.equal(rows[0].n, 0);
  });
});

describe('integrations', () => {
  it('the athlete sees their connection, and cannot mark themselves connected', async () => {
    assert.equal((await t.asUser(athlete, 'select status from integrations')).rows[0].status, 'connected');
    assert.ok(await t.expectRefused(other, `insert into integrations (athlete_id, provider, status) values ($1, 'coros', 'connected')`, [other]));
    await t.asUser(athlete, `update integrations set status = 'error' where athlete_id = $1`, [athlete]);
    assert.equal((await t.asService('select status from integrations where athlete_id = $1', [athlete])).rows[0].status, 'connected');
  });
});

describe('activity_imports ledger', () => {
  it('records an outcome from a fixed list', async () => {
    await t.asService(`insert into activity_imports (athlete_id, provider, external_id, outcome) values ($1, 'garmin', 'x1', 'imported')`, [athlete]);
    const refused = await t.asService(`insert into activity_imports (athlete_id, provider, external_id, outcome) values ($1, 'garmin', 'x2', 'whatever')`, [athlete]).then(() => null, (e) => e.message);
    assert.match(refused ?? '', /check/);
  });
  it('the same provider activity is one row', async () => {
    const refused = await t.asService(`insert into activity_imports (athlete_id, provider, external_id) values ($1, 'garmin', 'x1')`, [athlete]).then(() => null, (e) => e.message);
    assert.match(refused ?? '', /unique|duplicate/);
  });
  it('the athlete and coach can see what arrived; nobody else', async () => {
    assert.equal((await t.asUser(athlete, 'select id from activity_imports')).rows.length, 1);
    assert.equal((await t.asUser(coach, 'select id from activity_imports')).rows.length, 1);
    assert.equal((await t.asUser(other, 'select id from activity_imports')).rows.length, 0);
  });
});
