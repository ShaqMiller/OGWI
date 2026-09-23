import {
  READINESS_HORIZON_CAP_DAYS,
  READINESS_HORIZON_DEFAULT_DAYS,
  READINESS_HORIZON_FLOOR_DAYS,
} from '@ogwi/shared';
import { describe, expect, it } from 'vitest';
import { resolveHorizonDays } from '../horizon.util.js';

const now = new Date('2026-09-23T12:00:00Z');

describe('resolveHorizonDays', () => {
  it('defaults to three months before any pace data exists', () => {
    expect(resolveHorizonDays({ expectedFinishDate: null, now })).toBe(READINESS_HORIZON_DEFAULT_DAYS);
  });

  it('is the distance to the forecast finish date', () => {
    expect(resolveHorizonDays({ expectedFinishDate: '2026-12-22', now })).toBe(90);
  });

  it('never drops below the floor, however close the finish gets', () => {
    expect(resolveHorizonDays({ expectedFinishDate: '2026-09-24', now })).toBe(READINESS_HORIZON_FLOOR_DAYS);
    // A finish date already behind the learner still gets the floor, not a negative interval.
    expect(resolveHorizonDays({ expectedFinishDate: '2026-01-01', now })).toBe(READINESS_HORIZON_FLOOR_DAYS);
  });

  it('never exceeds the cap, however slow the pace', () => {
    expect(resolveHorizonDays({ expectedFinishDate: '2040-01-01', now })).toBe(READINESS_HORIZON_CAP_DAYS);
  });
});
