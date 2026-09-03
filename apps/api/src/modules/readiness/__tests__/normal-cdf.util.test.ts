import { describe, expect, it } from 'vitest';
import { normalCdf } from '../normal-cdf.util.js';

describe('normalCdf', () => {
  it('is 0.5 at the mean', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
  });

  it('matches well-known standard-normal reference points', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('approaches 0 and 1 at the tails', () => {
    expect(normalCdf(-6)).toBeCloseTo(0, 5);
    expect(normalCdf(6)).toBeCloseTo(1, 5);
  });

  it('is monotonically increasing', () => {
    const xs = [-3, -2, -1, 0, 1, 2, 3];
    const ys = xs.map(normalCdf);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    }
  });
});
