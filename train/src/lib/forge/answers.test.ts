import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { answerQuestion } from './answers.ts';

/**
 * FORGE has no model behind it, so its safety properties are testable exactly:
 * anything clinical must refuse and route to the human coach, and anything it
 * does not know must defer rather than improvise.
 */

describe('answerQuestion — refusals', () => {
  for (const question of [
    'my knee hurts, should I run?',
    'I think I have a stress fracture, what now?',
    'should I take painkillers before a race?',
    'is this shin pain an injury?',
    'do I need a physio for this?',
  ]) {
    it(`refuses and routes to the coach: "${question}"`, () => {
      const { matched, answer } = answerQuestion(question);
      assert.equal(matched, 'medical');
      assert.match(answer, /coach|doctor|physiotherapist/i);
      assert.doesNotMatch(answer, /ibuprofen|painkiller|anti-inflammator/i);
      assert.doesNotMatch(answer, /you (probably |likely )?have (a|an)\s/i);
    });
  }

  it('defers on an unknown question instead of inventing one', () => {
    const { matched, answer } = answerQuestion('what is the airspeed velocity of a swallow');
    assert.equal(matched, null);
    assert.match(answer, /coach/i);
  });

  it('defers on empty input', () => {
    assert.equal(answerQuestion('   ').matched, null);
  });

  it('puts the clinical check before keyword matching', () => {
    // mentions "zone 2", which would otherwise match a training answer
    const { matched } = answerQuestion('my calf is injured, can I still do zone 2?');
    assert.equal(matched, 'medical');
  });
});

describe('answerQuestion — training questions', () => {
  for (const [question, expected] of [
    ['what does zone 2 mean?', 'zone-2'],
    ['how do I rate rpe', 'rpe'],
    ['how is my forge score calculated', 'forge-score'],
    ['who can see me on the leaderboard', 'leaderboard'],
    ['what should I do about a missed session', 'missed'],
    ['how should I fuel a long run', 'long-run-fuel'],
  ] as const) {
    it(`answers: "${question}"`, () => {
      assert.equal(answerQuestion(question).matched, expected);
    });
  }
});
