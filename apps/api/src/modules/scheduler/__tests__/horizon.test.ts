import { READINESS_HORIZON_FLOOR_DAYS } from '@ogwi/shared';
import { describe, expect, it } from 'vitest';
import { fromCard, fsrsScheduler, gradeToRating, schedulerWithHorizon, toCardInput } from '../fsrs.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Answers an item correctly `times` times, each review happening on its due date. */
function studyUntilSettled(horizonDays: number | null, times: number) {
  const scheduler = horizonDays === null ? fsrsScheduler : schedulerWithHorizon(horizonDays);
  let now = new Date('2026-01-01T09:00:00Z');
  let state = null as ReturnType<typeof fromCard> | null;
  let longestGapDays = 0;

  for (let review = 0; review < times; review += 1) {
    const card = toCardInput(state, now);
    state = fromCard(scheduler.next(card, now, gradeToRating('good')).card);
    longestGapDays = Math.max(longestGapDays, (state.due.getTime() - now.getTime()) / DAY_MS);
    now = state.due;
  }

  return longestGapDays;
}

describe('the spacing horizon', () => {
  it('caps the scheduler at the learner’s horizon', () => {
    expect(schedulerWithHorizon(READINESS_HORIZON_FLOOR_DAYS).parameters.maximum_interval).toBe(
      READINESS_HORIZON_FLOOR_DAYS,
    );
  });

  it('holds reviews at the horizon, however well the learner does', () => {
    const cappedGap = studyUntilSettled(READINESS_HORIZON_FLOOR_DAYS, 12);

    // ts-fsrs caps the interval it computes, and a review taken exactly on its
    // due date can land one day past that - see schedulerWithHorizon.
    expect(cappedGap).toBeLessThanOrEqual(READINESS_HORIZON_FLOOR_DAYS + 1);
    // ...and the cap is doing something: uncapped, the same run goes far further.
    expect(studyUntilSettled(null, 12)).toBeGreaterThan(cappedGap * 2);
  });

  it('reuses one scheduler per horizon rather than rebuilding it per answer', () => {
    expect(schedulerWithHorizon(90)).toBe(schedulerWithHorizon(90));
    expect(schedulerWithHorizon(90)).not.toBe(schedulerWithHorizon(45));
  });
});
