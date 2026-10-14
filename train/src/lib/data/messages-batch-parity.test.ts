import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID, DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';

/**
 * THE BATCH MUST ANSWER EXACTLY WHAT THE SINGLE CALL ANSWERS.
 *
 * `listMessagesFor` exists only to stop the coach's messages screen paying
 * two round trips per athlete. The moment it disagrees with `listMessages`
 * about a single thread it stops being an optimisation and becomes a second,
 * quieter definition of what a conversation is — which is the failure this
 * codebase keeps having to undo.
 *
 * So the property under test is equivalence, not output: for every athlete on
 * the roster, the batch and the one-at-a-time call return the same messages
 * in the same order. The Postgres side of the same claim is
 * supabase/test/messages-batch.test.mjs.
 */

beforeEach(() => resetDemoData());

const send = (repo: DemoRepo, from: string, to: string, body: string) =>
  repo.sendMessage({
    threadId: `thread-${DEMO_ATHLETE_ID}`,
    senderId: from, recipientId: to, body, authorKind: 'human',
  });

const equivalent = async (repo: DemoRepo, ids: string[]) => {
  const batch = await repo.listMessagesFor(ids);
  for (const id of ids) {
    const single = await repo.listMessages(id);
    assert.deepEqual(batch.get(id) ?? [], single,
      `batch and single disagree for ${id}`);
  }
};

describe('listMessagesFor', () => {
  it('matches listMessages for every athlete on the roster', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listAthletesForCoach(DEMO_COACH_ID);
    assert.ok(roster.length > 1, 'needs a roster to be a real test');
    await equivalent(repo, roster.map((a) => a.id));
  });

  it('still matches after new messages in both directions', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Calf is tight.');
    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'Keep Monday easy.');
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Will do.');
    const roster = await repo.listAthletesForCoach(DEMO_COACH_ID);
    await equivalent(repo, roster.map((a) => a.id));
  });

  it('keeps each thread in chronological order', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'first');
    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'second');
    const got = (await repo.listMessagesFor([DEMO_ATHLETE_ID])).get(DEMO_ATHLETE_ID)!;
    const times = got.map((m) => m.createdAt);
    assert.deepEqual([...times].sort(), times, 'messages came back out of order');
    assert.equal(got.at(-1)?.body, 'second', 'the newest message must be last');
  });

  it('omits athletes with no conversation rather than inventing one', async () => {
    const repo = new DemoRepo();
    const batch = await repo.listMessagesFor(['nobody-at-all']);
    assert.equal(batch.get('nobody-at-all'), undefined);
    assert.deepEqual(await repo.listMessages('nobody-at-all'), []);
  });

  it('returns nothing for an empty roster, without querying', async () => {
    const repo = new DemoRepo();
    assert.equal((await repo.listMessagesFor([])).size, 0);
  });

  it('never leaks a thread the caller did not ask for', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const one = roster[0].id;
    const batch = await repo.listMessagesFor([one]);
    assert.deepEqual([...batch.keys()], batch.size ? [one] : [],
      'asking about one athlete returned somebody else');
  });
});
