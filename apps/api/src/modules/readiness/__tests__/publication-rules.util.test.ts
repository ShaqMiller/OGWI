import { describe, expect, it } from 'vitest';
import { chooseNextAction, scoreCandidate } from '../next-action.util.js';
import { decideCelebration, isForecastFrozen } from '../publication-rules.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-21T12:00:00Z');

describe('decideCelebration', () => {
  const rising = {
    unlocked: true,
    oddsRaw: 0.82,
    certaintyBand: 'fair' as const,
    previous: { unlocked: true, oddsRaw: 0.75 },
    alreadyCelebrated: false,
  };

  it('fires on a rising crossing of 80% with certainty fair or better', () => {
    expect(decideCelebration(rising)).toBe(true);
    expect(decideCelebration({ ...rising, certaintyBand: 'solid' })).toBe(true);
  });

  it('fires once, ever', () => {
    expect(decideCelebration({ ...rising, alreadyCelebrated: true })).toBe(false);
  });

  it('needs a crossing, not just a high number', () => {
    expect(decideCelebration({ ...rising, previous: { unlocked: true, oddsRaw: 0.85 } })).toBe(false);
  });

  it('counts a first score that arrives above the line as a crossing', () => {
    expect(decideCelebration({ ...rising, previous: null })).toBe(true);
    expect(decideCelebration({ ...rising, previous: { unlocked: false, oddsRaw: 0.9 } })).toBe(true);
  });

  it('stays quiet on early certainty, below 80%, or before the score unlocks', () => {
    expect(decideCelebration({ ...rising, certaintyBand: 'early' })).toBe(false);
    expect(decideCelebration({ ...rising, oddsRaw: 0.79 })).toBe(false);
    expect(decideCelebration({ ...rising, unlocked: false })).toBe(false);
  });
});

describe('isForecastFrozen', () => {
  it('freezes after 14 fully quiet days, and not before', () => {
    expect(isForecastFrozen({ lastReviewedAt: new Date(now.getTime() - 14 * DAY_MS), now })).toBe(true);
    expect(isForecastFrozen({ lastReviewedAt: new Date(now.getTime() - 13.9 * DAY_MS), now })).toBe(false);
  });

  it('has nothing to freeze for a learner who has never answered', () => {
    expect(isForecastFrozen({ lastReviewedAt: null, now })).toBe(false);
  });
});

describe('chooseNextAction', () => {
  it('picks the biggest improvement, counting a certainty-band step', () => {
    const refresh = scoreCandidate('refresh', 'r', 0.06, 0);
    const miniMock = scoreCandidate('mini_mock', 'm', -0.01, 1);

    expect(chooseNextAction([refresh, miniMock])?.kind).toBe('mini_mock');
    expect(chooseNextAction([scoreCandidate('refresh', 'r', 0.2, 0), miniMock])?.kind).toBe('refresh');
  });

  it('breaks ties toward the mini-mock, then the refresh', () => {
    const tie = (kind: 'refresh' | 'biggest_opportunity' | 'mini_mock') => scoreCandidate(kind, kind, 0.05, 0);

    expect(chooseNextAction([tie('biggest_opportunity'), tie('refresh'), tie('mini_mock')])?.kind).toBe('mini_mock');
    expect(chooseNextAction([tie('biggest_opportunity'), tie('refresh')])?.kind).toBe('refresh');
  });

  it('suggests nothing when nothing would help', () => {
    expect(chooseNextAction([scoreCandidate('refresh', 'r', 0, 0), scoreCandidate('mini_mock', 'm', -0.02, 0)])).toBeNull();
    expect(chooseNextAction([])).toBeNull();
  });
});
