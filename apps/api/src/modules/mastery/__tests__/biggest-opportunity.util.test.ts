import { describe, expect, it } from 'vitest';
import { pickBiggestOpportunity } from '../biggest-opportunity.util.js';

const module = (moduleId: string, blueprintWeight: number, displayedScore: number) => ({
  moduleId,
  moduleName: moduleId,
  blueprintWeight,
  displayedScore,
});

describe('pickBiggestOpportunity', () => {
  it("matches the spec's worked check: a 20%-weight module at 55 against a 75 bar drags 4.0", () => {
    const pick = pickBiggestOpportunity([module('heavy', 0.2, 0.55), module('light', 0.05, 0)], 0.75);

    expect(pick?.moduleId).toBe('heavy');
    expect(pick?.drag).toBeCloseTo(0.04, 10);
    expect(pick?.displayedScore).toBe(0.55);
  });

  it('breaks a tie toward the heavier module', () => {
    // 0.1 x 0.4 and 0.2 x 0.2 both drag 0.04.
    const pick = pickBiggestOpportunity([module('light', 0.1, 0.3), module('heavy', 0.2, 0.5)], 0.7);

    expect(pick?.moduleId).toBe('heavy');
  });

  it('points nowhere once every module is at or above the pass mark', () => {
    expect(pickBiggestOpportunity([module('a', 0.5, 0.7), module('b', 0.5, 0.9)], 0.7)).toBeNull();
  });
});
