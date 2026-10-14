import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays } from './dates.ts';
import { rpeFromZones, sessionLoad, strengthLoad, summariseLoad, trendFor, type SessionLoad } from './load.ts';
import { athleteLoad } from '../activity/training-load.ts';
import type { CompletedWorkout } from './types.ts';

const TODAY = '2026-10-14';

/** n days of the same load each day, ending today. */
const steady = (days: number, load: number): SessionLoad[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(TODAY, -i), load, basis: 'rpe' as const }));

describe('session load', () => {
  it('is RPE times minutes', () => {
    assert.deepEqual(sessionLoad({ date: TODAY, rpe: 6, actualDurationMinutes: 50 }), { date: TODAY, load: 300, basis: 'rpe' });
  });

  it('an easy and a hard session of the same length are not the same load', () => {
    const easy = sessionLoad({ date: TODAY, rpe: 3, actualDurationMinutes: 45 })!;
    const hard = sessionLoad({ date: TODAY, rpe: 8, actualDurationMinutes: 45 })!;
    assert.ok(hard.load > easy.load * 2);
  });

  it('falls back to heart rate, and says so', () => {
    assert.equal(sessionLoad({ date: TODAY, rpe: null, actualDurationMinutes: 40 }, 5.5)?.basis, 'heart_rate');
  });

  it('is not guessed when there is neither RPE nor heart rate, or no duration', () => {
    assert.equal(sessionLoad({ date: TODAY, rpe: null, actualDurationMinutes: 40 }), null);
    assert.equal(sessionLoad({ date: TODAY, rpe: 5, actualDurationMinutes: null }), null);
  });

  it('estimates RPE from time in zones', () => {
    assert.equal(rpeFromZones([0, 3600, 0, 0, 0]), 3.5);
    assert.equal(rpeFromZones([0, 0, 0, 0, 0]), null);
    const mixed = rpeFromZones([0, 1800, 0, 1800, 0])!;
    assert.ok(mixed > 3.5 && mixed < 7.5);
  });

  it('scores strength from the sets’ RPE', () => {
    const s = strengthLoad({
      date: TODAY,
      status: 'completed',
      durationMinutes: 40,
      logs: [7, 8, null].map((rpe, i) => ({ exerciseId: 'x', setIndex: i, reps: 5, weightKg: 60, rpe, completed: true })),
    });
    assert.equal(s?.load, 300);
    assert.equal(strengthLoad({ date: TODAY, status: 'scheduled', durationMinutes: 40, logs: [] }), null);
  });
});

describe('fitness, fatigue, form', () => {
  it('settles to the daily load when training is constant', () => {
    const s = summariseLoad(steady(400, 300), 0, TODAY);
    assert.ok(Math.abs(s.fitness - 300) < 5, `fitness ${s.fitness}`);
    assert.ok(Math.abs(s.fatigue - 300) < 1, `fatigue ${s.fatigue}`);
    assert.ok(Math.abs(s.form) < 5);
    assert.equal(s.ratio, 1);
    assert.equal(s.trend, 'steady');
  });

  it('a sudden jump raises fatigue before fitness, and form goes negative', () => {
    const base = steady(120, 200).filter((d) => d.date <= addDays(TODAY, -7));
    const jump = steady(7, 500);
    const s = summariseLoad([...base, ...jump], 0, TODAY);
    assert.ok(s.fatigue > s.fitness);
    assert.ok(s.form < 0);
    assert.equal(s.trend, 'building_fast');
  });

  it('a taper is easing off, and form goes positive', () => {
    const base = steady(120, 300).filter((d) => d.date <= addDays(TODAY, -7));
    const taper = steady(7, 60);
    const s = summariseLoad([...base, ...taper], 0, TODAY);
    assert.ok(s.form > 0);
    assert.equal(s.trend, 'easing');
  });

  it('no ratio until there are four weeks to compare against', () => {
    assert.equal(summariseLoad(steady(10, 300), 0, TODAY).ratio, null);
    assert.equal(summariseLoad([], 0, TODAY).trend, null);
  });

  it('returns the window asked for, ending today', () => {
    const s = summariseLoad(steady(200, 100), 0, TODAY, 28);
    assert.equal(s.days.length, 28);
    assert.equal(s.days[s.days.length - 1].date, TODAY);
  });

  it('trend bands', () => {
    assert.deepEqual([0.7, 1, 1.4, 1.6].map(trendFor), ['easing', 'steady', 'building', 'building_fast']);
  });
});

describe('athleteLoad', () => {
  const log = (id: string, date: string, rpe: number | null, mins: number): CompletedWorkout => ({
    id, scheduledWorkoutId: null, athleteId: 'a', date, type: 'easy_run', actualDistanceKm: 8, actualDurationMinutes: mins,
    averagePaceSecPerKm: 330, averageHeartRate: null, maxHeartRate: null, rpe, sessionRating: null, soreness: null,
    athleteNotes: null, source: rpe == null ? 'upload' : 'manual', createdAt: '',
  });

  it('uses the watch’s heart rate where the athlete gave no RPE, and counts what it could not score', () => {
    const activity = { completedWorkoutId: 'c2', hrHistogram: [[130, 2400]] } as never;
    const s = athleteLoad({
      completed: [log('c1', TODAY, 4, 45), log('c2', TODAY, null, 40), log('c3', TODAY, null, 30)],
      strength: [],
      activities: [activity],
      maxHr: 190,
      today: TODAY,
    });
    assert.deepEqual(s.scored, { rpe: 1, heartRate: 1, unscored: 1 });
  });

  it('without a max heart rate, an upload with no RPE is unscored rather than guessed', () => {
    const activity = { completedWorkoutId: 'c2', hrHistogram: [[130, 2400]] } as never;
    const s = athleteLoad({ completed: [log('c2', TODAY, null, 40)], strength: [], activities: [activity], maxHr: null, today: TODAY });
    assert.deepEqual(s.scored, { rpe: 0, heartRate: 0, unscored: 1 });
  });
});
