import { describe, expect, it } from 'vitest';
import { resolveCertaintyBand } from '../certainty-band.util.js';

const NOW = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('resolveCertaintyBand', () => {
  it('stays early on coverage alone, however complete', () => {
    // The whole point of the change: answering everything once is not
    // evidence of performing under exam conditions.
    expect(resolveCertaintyBand(1, [], NOW)).toBe('early');
  });

  it('is solid at >=70% coverage with 2 runs inside 30 days', () => {
    expect(resolveCertaintyBand(0.7, [daysAgo(1), daysAgo(29)], NOW)).toBe('solid');
  });

  it('falls back to fair when one of the two runs has aged out of 30 days', () => {
    expect(resolveCertaintyBand(0.9, [daysAgo(1), daysAgo(40)], NOW)).toBe('fair');
  });

  it('is fair with a single recent run', () => {
    expect(resolveCertaintyBand(0.9, [daysAgo(5)], NOW)).toBe('fair');
  });

  it('is fair at exactly the 40% coverage floor with one run inside 45 days', () => {
    expect(resolveCertaintyBand(0.4, [daysAgo(44)], NOW)).toBe('fair');
  });

  it('is early below 40% coverage no matter how many runs', () => {
    const runs = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5)];
    expect(resolveCertaintyBand(0.39, runs, NOW)).toBe('early');
  });

  it('is early when every run has aged out of the wider window', () => {
    expect(resolveCertaintyBand(1, [daysAgo(46), daysAgo(60)], NOW)).toBe('early');
  });

  it('treats the window boundaries as inclusive', () => {
    // Exactly 30 days old still counts toward solid...
    expect(resolveCertaintyBand(0.8, [daysAgo(30), daysAgo(30)], NOW)).toBe('solid');
    // ...and exactly 45 still counts toward fair.
    expect(resolveCertaintyBand(0.8, [daysAgo(45)], NOW)).toBe('fair');
  });
});
