import { describe, expect, it } from 'vitest';
import { evaluateFill } from '../physics.util.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + n * 24 * 60 * 60 * 1000);

describe('evaluateFill', () => {
  it('returns the starting fill at zero elapsed time', () => {
    expect(evaluateFill(500, day(0), day(0))).toBe(500);
  });

  it('halves a fill at/above 200ft every 24 hours, until it crosses into the linear zone', () => {
    expect(evaluateFill(400, day(0), day(1))).toBeCloseTo(200, 5);
    // Crosses 200ft exactly at day 1, then decays linearly (90ft/day) for
    // the second day: 200 - 90 = 110, not a continued halving to 100.
    expect(evaluateFill(400, day(0), day(2))).toBeCloseTo(110, 5);
  });

  it('drains a fill below 200ft linearly at 90ft/day', () => {
    expect(evaluateFill(150, day(0), day(1))).toBeCloseTo(60, 5);
  });

  it('never goes negative - clamps at 0 once fully drained', () => {
    expect(evaluateFill(150, day(0), day(10))).toBe(0);
  });

  it('evaluates piecewise across the 200ft boundary', () => {
    // Starting at 400, halving daily: crosses 200ft at exactly 1 day.
    // From day 1 to day 1.5 (12h = 0.5 day more), linear drain applies:
    // 200 - 90*0.5 = 155.
    const result = evaluateFill(400, day(0), new Date(day(1).getTime() + 12 * 60 * 60 * 1000));
    expect(result).toBeCloseTo(155, 5);
  });

  it('is continuous at the boundary (no jump right at the crossing instant)', () => {
    const justBefore = evaluateFill(400, day(0), new Date(day(1).getTime() - 1));
    const justAfter = evaluateFill(400, day(0), new Date(day(1).getTime() + 1));
    expect(justBefore).toBeCloseTo(200, 1);
    expect(justAfter).toBeCloseTo(200, 1);
  });
});
