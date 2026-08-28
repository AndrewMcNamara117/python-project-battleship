import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID, DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';

/**
 * Who is waiting on whom — in memory.
 *
 * The Postgres side is supabase/test/waiting-replies.test.mjs, and this file
 * makes the same claims of the demo adapter, scenario for scenario. Two
 * implementations of one definition is a thing worth being nervous about, so
 * the nervousness is written down as tests rather than left as a hope.
 */

beforeEach(() => resetDemoData());

const today = () => new Date().toISOString().slice(0, 10);

const send = (repo: DemoRepo, from: string, to: string, body: string) =>
  repo.sendMessage({
    threadId: `thread-${DEMO_ATHLETE_ID}`,
    senderId: from,
    recipientId: to,
    body,
    authorKind: 'human',
  });

const waiting = async (repo: DemoRepo) => {
  const roster = await repo.listRoster(DEMO_COACH_ID, today());
  return roster.find((e) => e.athleteId === DEMO_ATHLETE_ID)!;
};

describe('demo waiting replies — parity', () => {
  it('raises nothing while the coach spoke last', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'Good session on Sunday.');
    const e = await waiting(repo);
    assert.equal(e.conversation, null);
    assert.ok(!e.signals.some((s) => s.kind === 'awaiting_reply'));
  });

  it('raises it as soon as the athlete speaks last', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Can I move Thursday to Friday?');
    const e = await waiting(repo);
    assert.ok(e.conversation);
    assert.equal(e.conversation!.unanswered, 1);
    assert.match(e.conversation!.latest, /move Thursday/);
    assert.ok(e.signals.some((s) => s.kind === 'awaiting_reply'));
  });

  it('clears it when the coach answers — the bug this slice fixes', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Should I race Sunday?');
    assert.ok((await waiting(repo)).conversation, 'waiting before the reply');

    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'Yes — treat it as a tempo.');
    const after = await waiting(repo);
    assert.equal(after.conversation, null, 'answering is what clears it');
    assert.ok(!after.signals.some((s) => s.kind === 'awaiting_reply'));
  });

  it('keeps it when the coach has read but not replied', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'My shoes are worn through.');
    await repo.markMessagesRead(DEMO_ATHLETE_ID, DEMO_COACH_ID);

    const e = await waiting(repo);
    assert.equal(e.unreadFromAthlete, 0, 'genuinely read');
    assert.ok(e.conversation, 'and genuinely still waiting');
  });

  it('treats a run of messages as one conversation, dated from the first', async () => {
    const repo = new DemoRepo();
    const first = await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Quick one');
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Actually two things');
    const last = await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Sorry, three');

    const e = await waiting(repo);
    assert.equal(e.conversation!.unanswered, 3, 'three messages');
    assert.equal(e.conversation!.waitingSince, first.createdAt,
      'they have been waiting since the first one, not the last');
    assert.notEqual(e.conversation!.waitingSince, last.createdAt);
    assert.match(e.conversation!.latest, /Sorry, three/, 'and the newest is what they last said');
    assert.equal(e.signals.filter((s) => s.kind === 'awaiting_reply').length, 1,
      'one workload item, not three');
  });

  it('starts the clock again after the coach speaks', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'First question');
    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'Answered.');
    const second = await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Follow-up');

    const e = await waiting(repo);
    assert.equal(e.conversation!.unanswered, 1, 'only what came after the reply');
    assert.equal(e.conversation!.waitingSince, second.createdAt);
  });

  it('does not let a FORGE message answer for the coach', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Achilles is worse today.');
    await repo.sendMessage({
      threadId: `thread-${DEMO_ATHLETE_ID}`,
      senderId: DEMO_COACH_ID,
      recipientId: DEMO_ATHLETE_ID,
      body: 'FORGE: your week is ready.',
      authorKind: 'forge',
    });
    assert.ok((await waiting(repo)).conversation,
      'an automated note is not a coach answering');
  });

  it('leaves an unrelated concern alone when the coach replies', async () => {
    const repo = new DemoRepo();
    await send(repo, DEMO_ATHLETE_ID, DEMO_COACH_ID, 'Achilles is worse today.');
    const before = await waiting(repo);
    const others = before.signals.filter((s) => s.kind !== 'awaiting_reply').map((s) => s.kind);

    await send(repo, DEMO_COACH_ID, DEMO_ATHLETE_ID, 'Take Thursday off and we will look at it.');
    const after = await waiting(repo);

    assert.ok(!after.signals.some((s) => s.kind === 'awaiting_reply'), 'the wait is settled');
    assert.deepEqual(after.signals.filter((s) => s.kind !== 'awaiting_reply').map((s) => s.kind),
      others, 'and nothing else moved because of it');
  });
});
