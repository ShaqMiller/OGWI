import { describe, expect, it } from 'vitest';
import { computeCalibration, type CalibrationRunInput } from '../calibration.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-21T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

function run(achieved: number, projected: number, ageDays = 0): CalibrationRunInput {
  return {
    submittedAt: daysAgo(ageDays),
    correctCount: Math.round(achieved * 100),
    scoredCount: 100,
    projectedScore: projected,
  };
}

describe('computeCalibration', () => {
  it('leaves the projection alone when there are no runs', () => {
    const calibration = computeCalibration([], now);

    expect(calibration.ratio).toBe(1);
    expect(calibration.meanRatio).toBeNull();
    expect(calibration.runsUsed).toBe(0);
  });

  it('is achieved score over the projection at that moment', () => {
    const calibration = computeCalibration([run(0.72, 0.8)], now);

    expect(calibration.meanRatio).toBeCloseTo(0.9, 10);
    expect(calibration.ratio).toBeCloseTo(0.9, 10);
    expect(calibration.runs[0]).toMatchObject({ achievedScore: 0.72, projectedScore: 0.8 });
  });

  it('clamps the mean to [0.7, 1.1]', () => {
    expect(computeCalibration([run(0.2, 0.8)], now).ratio).toBe(0.7);
    expect(computeCalibration([run(1, 0.5)], now).ratio).toBe(1.1);
    // The unclamped mean is still reported, for the piece-by-piece breakdown.
    expect(computeCalibration([run(0.2, 0.8)], now).meanRatio).toBeCloseTo(0.25, 10);
  });

  it('weights recent runs more, halving every 30 days', () => {
    // Ratios 0.8 (60 days old, weight 1/4) and 1.0 (today, weight 1).
    const calibration = computeCalibration([run(0.64, 0.8, 60), run(0.8, 0.8, 0)], now);

    expect(calibration.runs.map((detail) => detail.weight)).toEqual([0.25, 1]);
    expect(calibration.meanRatio).toBeCloseTo((0.8 * 0.25 + 1 * 1) / 1.25, 10);
  });

  it('does not let a near-zero projection explode the ratio', () => {
    const calibration = computeCalibration([run(0.5, 0.01), run(0.8, 0.8)], now);

    expect(calibration.runs[0]).toMatchObject({ ratio: null, weight: 0 });
    expect(calibration.runsUsed).toBe(1);
    expect(calibration.ratio).toBeCloseTo(1, 10);
  });

  it('falls back to 1.0 when no run can calibrate', () => {
    const calibration = computeCalibration([run(0.5, 0)], now);

    expect(calibration.ratio).toBe(1);
    expect(calibration.runsUsed).toBe(0);
  });
});
