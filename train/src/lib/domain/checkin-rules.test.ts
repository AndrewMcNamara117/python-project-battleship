import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { triageCheckIn } from './checkin-rules.ts';
import type { CheckInScores } from './types.ts';

/**
 * These tests guard the safety-critical path: whether a check-in reaches a human
 * coach quickly, and whether the athlete-facing message stays out of clinical
 * territory. They are the rules most expensive to get wrong.
 */

const healthy: CheckInScores = {
  fatigue: 4,
  sleep: 8,
  soreness: 3,
  stress: 3,
  motivation: 8,
  confidence: 8,
  trainingDifficulty: 5,
};

const fullWeek = { sessionsCompleted: 5, sessionsPrescribed: 5, history: [] };

describe('triageCheckIn — red flags', () => {
  it('leaves a clean week unflagged', () => {
    const r = triageCheckIn({ scores: healthy, freeText: ['Good week.'], ...fullWeek });
    assert.equal(r.level, 'none');
    assert.equal(r.reasons.length, 0);
    assert.equal(r.athleteGuidance, null);
  });

  for (const [label, text] of [
    ['chest pain', 'Some chest pain on the long run'],
    ['dizziness', 'Felt dizzy after the session'],
    ['fainting', 'I blacked out on Tuesday'],
    ['numbness', 'Numbness in my foot for two days'],
    ['sharp pain', 'Sharp pain in the shin every step'],
    ['worsening', 'The ache is worsening each week'],
  ] as const) {
    it(`escalates ${label} to attention with stop-and-seek-care guidance`, () => {
      const r = triageCheckIn({ scores: healthy, freeText: [text], ...fullWeek });
      assert.equal(r.level, 'attention');
      assert.ok(r.athleteGuidance, 'expected athlete guidance');
      assert.match(r.athleteGuidance, /doctor|physiotherapist/);
    });
  }

  it('never phrases the guidance as a diagnosis', () => {
    const r = triageCheckIn({ scores: healthy, freeText: ['Sharp pain in my knee'], ...fullWeek });
    assert.ok(r.athleteGuidance);
    assert.doesNotMatch(r.athleteGuidance, /you (probably |likely |may )?have (a|an|some)\s/i);
    assert.doesNotMatch(r.athleteGuidance, /sounds like|it is probably/i);
    assert.match(r.athleteGuidance, /not a diagnosis/i);
  });

  it('treats an ordinary niggle as watch, not urgent', () => {
    const r = triageCheckIn({ scores: healthy, freeText: ['Slight niggle in the calf'], ...fullWeek });
    assert.equal(r.level, 'watch');
    assert.equal(r.athleteGuidance, null);
  });
});

describe('triageCheckIn — patterns across weeks', () => {
  it('escalates repeated high soreness on its own', () => {
    const r = triageCheckIn({
      scores: { ...healthy, soreness: 7 },
      freeText: ['Fine'],
      ...fullWeek,
      history: [{ scores: { ...healthy, soreness: 8 } }],
    });
    assert.equal(r.level, 'attention');
    assert.ok(r.reasons.some((x) => /soreness two weeks/i.test(x)));
  });

  it('escalates repeated low motivation on its own', () => {
    const r = triageCheckIn({
      scores: { ...healthy, motivation: 4 },
      freeText: ['Fine'],
      ...fullWeek,
      history: [{ scores: { ...healthy, motivation: 3 } }],
    });
    assert.equal(r.level, 'attention');
  });

  it('escalates repeated poor sleep on its own', () => {
    const r = triageCheckIn({
      scores: { ...healthy, sleep: 4 },
      freeText: ['Fine'],
      ...fullWeek,
      history: [{ scores: { ...healthy, sleep: 3 } }],
    });
    assert.equal(r.level, 'attention');
  });

  it('escalates a sharp week-on-week rise in fatigue', () => {
    const r = triageCheckIn({
      scores: { ...healthy, fatigue: 8 },
      freeText: ['Fine'],
      ...fullWeek,
      history: [{ scores: { ...healthy, fatigue: 4 } }],
    });
    assert.equal(r.level, 'attention');
  });
});

describe('triageCheckIn — adherence', () => {
  it('escalates three or more missed sessions on its own', () => {
    const r = triageCheckIn({
      scores: healthy,
      freeText: ['Fine'],
      sessionsCompleted: 2,
      sessionsPrescribed: 6,
      history: [],
    });
    assert.equal(r.level, 'attention');
    assert.ok(r.reasons.some((x) => /missed/i.test(x)));
  });

  it('flags low adherence without escalating it alone', () => {
    const r = triageCheckIn({
      scores: healthy,
      freeText: ['Fine'],
      sessionsCompleted: 2,
      sessionsPrescribed: 4,
      history: [],
    });
    assert.equal(r.level, 'watch');
  });

  it('does not divide by zero on a week with nothing prescribed', () => {
    const r = triageCheckIn({
      scores: healthy,
      freeText: ['Fine'],
      sessionsCompleted: 0,
      sessionsPrescribed: 0,
      history: [],
    });
    assert.equal(r.level, 'none');
  });

  it('reports each reason once', () => {
    const r = triageCheckIn({
      scores: { ...healthy, soreness: 9, sleep: 2, motivation: 2 },
      freeText: ['Sore and tired'],
      sessionsCompleted: 0,
      sessionsPrescribed: 5,
      history: [{ scores: { ...healthy, soreness: 8, sleep: 3, motivation: 3 } }],
    });
    assert.equal(new Set(r.reasons).size, r.reasons.length);
  });
});
