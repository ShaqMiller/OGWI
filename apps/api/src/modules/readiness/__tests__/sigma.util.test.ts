import { READINESS_SIGMA_BASE, READINESS_SIGMA_EVIDENCE_BASE, READINESS_SIGMA_FLOOR } from '@ogwi/shared';
import { describe, expect, it } from 'vitest';
import type { Calibration } from '../calibration.util.js';
import { computeSigma } from '../sigma.util.js';

const noRuns: Calibration = { ratio: 1, meanRatio: null, runsUsed: 0, runs: [] };

function runs(...ratios: [ratio: number, weight: number][]): Calibration {
  return {
    ratio: 1,
    meanRatio: 1,
    runsUsed: ratios.length,
    runs: ratios.map(([ratio, weight]) => ({
      submittedAt: new Date('2026-09-01T00:00:00Z'),
      achievedScore: ratio * 0.8,
      projectedScore: 0.8,
      ratio,
      weight,
    })),
  };
}

const certain = Array.from({ length: 30 }, () => 1);

describe('computeSigma', () => {
  it('is dominated by untouched coverage early on', () => {
    const { components } = computeSigma({
      weightedCoverage: 0.1,
      projectedScore: 0.1,
      calibration: noRuns,
      itemProbabilities: [],
    });

    expect(components.coverage).toBeCloseTo(READINESS_SIGMA_BASE * 0.9, 10);
    expect(components.coverage).toBeGreaterThan(components.evidence);
  });

  it('narrows as recent exam runs accumulate', () => {
    const base = { weightedCoverage: 1, projectedScore: 0.8, itemProbabilities: certain };

    const none = computeSigma({ ...base, calibration: noRuns }).components.evidence;
    const one = computeSigma({ ...base, calibration: runs([1, 1]) }).components.evidence;
    const two = computeSigma({ ...base, calibration: runs([1, 1], [1, 1]) }).components.evidence;

    expect(none).toBeCloseTo(READINESS_SIGMA_EVIDENCE_BASE, 10);
    expect(one).toBeCloseTo(READINESS_SIGMA_EVIDENCE_BASE / 2, 10);
    expect(two).toBeLessThan(one);
  });

  it('widens when exam runs disagree with each other', () => {
    const base = { weightedCoverage: 1, projectedScore: 0.8, itemProbabilities: certain };

    const agreeing = computeSigma({ ...base, calibration: runs([1, 1], [1, 1]) }).components.spread;
    const disagreeing = computeSigma({ ...base, calibration: runs([0.8, 1], [1.2, 1]) }).components.spread;

    expect(agreeing).toBe(0);
    // Ratios 0.8 and 1.2: standard deviation 0.2, times the 0.8 projection.
    expect(disagreeing).toBeCloseTo(0.16, 10);
  });

  it('counts the sampling noise of sitting a paper', () => {
    const coinFlips = Array.from({ length: 30 }, () => 0.5);
    const { components } = computeSigma({
      weightedCoverage: 1,
      projectedScore: 0.5,
      calibration: noRuns,
      itemProbabilities: coinFlips,
    });

    expect(components.residual).toBeCloseTo(Math.sqrt(0.25 / 30), 10);
    expect(computeSigma({ weightedCoverage: 1, projectedScore: 1, calibration: noRuns, itemProbabilities: certain }).components.residual).toBe(0);
  });

  it('combines the ingredients as independent sources, never below the floor', () => {
    const result = computeSigma({ weightedCoverage: 1, projectedScore: 0.8, calibration: runs([1, 1]), itemProbabilities: certain });
    const { coverage, evidence, spread, residual } = result.components;

    expect(result.sigma).toBeCloseTo(
      Math.max(READINESS_SIGMA_FLOOR, Math.sqrt(coverage ** 2 + evidence ** 2 + spread ** 2 + residual ** 2)),
      10,
    );
    expect(result.sigma).toBeGreaterThanOrEqual(READINESS_SIGMA_FLOOR);
  });
});
