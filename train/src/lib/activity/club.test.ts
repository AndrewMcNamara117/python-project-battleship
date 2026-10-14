import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_ATHLETE_ID, DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from '@/lib/data/demo-repo';
import { addDays, toISODate } from '@/lib/domain/dates';
import type { Profile } from '@/lib/domain/types';
import { syntheticRun, toFit } from './fixtures.ts';
import { importActivity } from './service.ts';

/**
 * The demo adapter holds the club feed to the same limits migration 0022
 * sets in Postgres (supabase/test/club-feed.test.mjs is that side).
 */

beforeEach(() => resetDemoData());

const OTHER = 'demo-athlete-2';
const STRANGER = 'demo-athlete-5';

async function mine(repo: DemoRepo, visibility: 'coach' | 'club') {
  const profile = (await repo.getProfile(DEMO_ATHLETE_ID)) as Profile;
  const far = addDays(toISODate(new Date()), 300 + Math.floor(Math.random() * 50));
  const out = await importActivity(repo, profile, toFit(syntheticRun({ start: `${far}T07:00:00Z`, distanceKm: 6, paceSecPerKm: 330 })));
  await repo.updateActivity(out.activity.id, { visibility });
  return out.activity.id;
}

describe('club feed — demo parity', () => {
  it('the seeded feed has the club in it, newest first', async () => {
    const feed = await new DemoRepo().listClubFeed(DEMO_ATHLETE_ID);
    assert.ok(feed.length >= 8);
    for (let i = 1; i < feed.length; i++) assert.ok(feed[i - 1].startedAt >= feed[i].startedAt);
    assert.ok(feed.some((f) => f.commentCount > 0 && f.kudosCount > 0));
  });

  it('a feed item never carries heart rate, splits or the plan', async () => {
    const [item] = await new DemoRepo().listClubFeed(DEMO_ATHLETE_ID);
    for (const leak of ['avgHr', 'maxHr', 'hrHistogram', 'series', 'splits', 'scheduledWorkoutId', 'completedWorkoutId']) {
      assert.ok(!(leak in item), `${leak} must not be in a feed item`);
    }
  });

  it('an unshared activity is invisible to the club, visible to its athlete and coach', async () => {
    const repo = new DemoRepo();
    const id = await mine(repo, 'coach');
    assert.equal(await repo.getFeedItem(OTHER, id), null);
    assert.ok(await repo.getFeedItem(DEMO_ATHLETE_ID, id));
    assert.ok(await repo.getFeedItem(DEMO_COACH_ID, id));
    assert.ok(!(await repo.listClubFeed(OTHER)).some((f) => f.id === id));
  });

  it('kudos: on a shared run, once, never your own', async () => {
    const repo = new DemoRepo();
    const id = await mine(repo, 'club');
    await repo.giveKudos(id, OTHER);
    await repo.giveKudos(id, OTHER);
    assert.equal((await repo.getFeedItem(OTHER, id))?.kudosCount, 1);
    assert.equal((await repo.getFeedItem(OTHER, id))?.viewerKudos, true);
    await assert.rejects(repo.giveKudos(id, DEMO_ATHLETE_ID));
    await repo.takeBackKudos(id, OTHER);
    assert.equal((await repo.getFeedItem(OTHER, id))?.kudosCount, 0);

    const hidden = await mine(repo, 'coach');
    await assert.rejects(repo.giveKudos(hidden, OTHER));
  });

  it('comments: members on shared runs, the coach always, nobody on a hidden one', async () => {
    const repo = new DemoRepo();
    const hidden = await mine(repo, 'coach');
    await assert.rejects(repo.addComment(hidden, OTHER, 'hi'));
    await repo.addComment(hidden, DEMO_COACH_ID, 'Good control.');
    assert.equal((await repo.getActivitySocial(OTHER, hidden)).comments.length, 0, 'the club cannot read it');
    assert.equal((await repo.getActivitySocial(DEMO_ATHLETE_ID, hidden)).comments[0].authorName, 'R. Doyle');

    await assert.rejects(repo.addComment(hidden, DEMO_ATHLETE_ID, '   '));
    await assert.rejects(repo.addComment(hidden, DEMO_ATHLETE_ID, 'x'.repeat(501)));
  });

  it('removing: a stranger cannot, the author can, the athlete can on their own run', async () => {
    const repo = new DemoRepo();
    const id = await mine(repo, 'club');
    const a = await repo.addComment(id, OTHER, 'Flying');
    await repo.deleteComment(a.id, STRANGER);
    assert.equal((await repo.getActivitySocial(OTHER, id)).comments.length, 1);
    await repo.deleteComment(a.id, DEMO_ATHLETE_ID);
    assert.equal((await repo.getActivitySocial(OTHER, id)).comments.length, 0);

    const b = await repo.addComment(id, OTHER, 'Again');
    await repo.deleteComment(b.id, OTHER);
    assert.equal((await repo.getActivitySocial(OTHER, id)).comments.length, 0);
  });

  it('un-sharing hides the conversation from the club', async () => {
    const repo = new DemoRepo();
    const id = await mine(repo, 'club');
    await repo.addComment(id, OTHER, 'Nice');
    await repo.updateActivity(id, { visibility: 'coach' });
    assert.equal((await repo.getActivitySocial(STRANGER, id)).comments.length, 0);
    assert.equal((await repo.getActivitySocial(DEMO_ATHLETE_ID, id)).comments.length, 1);
  });

  it('an import follows the athlete’s sharing default', async () => {
    const repo = new DemoRepo();
    await repo.updateProfile(DEMO_ATHLETE_ID, { shareActivitiesDefault: true });
    const profile = (await repo.getProfile(DEMO_ATHLETE_ID)) as Profile;
    const far = addDays(toISODate(new Date()), 500);
    const out = await importActivity(repo, profile, toFit(syntheticRun({ start: `${far}T07:00:00Z`, distanceKm: 5, paceSecPerKm: 300 })));
    assert.equal((await repo.getActivity(out.activity.id))?.visibility, 'club');
  });

  it('deleting an activity takes its kudos and comments with it', async () => {
    const repo = new DemoRepo();
    const id = await mine(repo, 'club');
    await repo.giveKudos(id, OTHER);
    await repo.addComment(id, OTHER, 'Gone soon');
    await repo.deleteActivity(id);
    assert.deepEqual(await repo.getActivitySocial(DEMO_ATHLETE_ID, id), { comments: [], kudos: [] });
  });
});
