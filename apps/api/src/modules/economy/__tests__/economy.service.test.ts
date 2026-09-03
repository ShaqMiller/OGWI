import {
  PREMIUM_CUSTOM_EXAM,
  PREMIUM_EXAM_SIMULATION,
  PREMIUM_MINI_MOCK,
} from '@ogwi/shared';
import { describe, expect, it } from 'vitest';
import * as economyService from '../economy.service.js';
import { priceReviewGrade } from '../economy.service.js';

describe('priceReviewGrade', () => {
  it('pays 0 for an incorrect answer, regardless of prior state', () => {
    expect(priceReviewGrade({ hadPriorState: false, wasDue: false, grade: 'again' })).toBe(0);
    expect(priceReviewGrade({ hadPriorState: true, wasDue: true, grade: 'again' })).toBe(0);
  });

  it('pays the first-correct rate for a brand-new item answered correctly', () => {
    expect(priceReviewGrade({ hadPriorState: false, wasDue: false, grade: 'good' })).toBe(5);
  });

  it('pays the top rate for a correct answer on a due item', () => {
    expect(priceReviewGrade({ hadPriorState: true, wasDue: true, grade: 'good' })).toBe(7);
  });

  it('pays the trickle rate for a correct answer on a not-yet-due item', () => {
    expect(priceReviewGrade({ hadPriorState: true, wasDue: false, grade: 'good' })).toBe(1);
  });
});

describe('priceExamPremium', () => {
  it('pays the simulation rate for a completed paper', () => {
    expect(
      economyService.priceExamPremium({ kind: 'SIMULATION', answeredCount: 8, questionCount: 8 }),
    ).toBe(PREMIUM_EXAM_SIMULATION);
  });

  it('prices the run kinds that do not exist yet', () => {
    // Priced now so the table matches Doc 2 B8 and these become live for free
    // when the run kinds land, rather than needing the economy reopened.
    expect(
      economyService.priceExamPremium({ kind: 'MINI_MOCK', answeredCount: 10, questionCount: 10 }),
    ).toBe(PREMIUM_MINI_MOCK);
    expect(
      economyService.priceExamPremium({ kind: 'CUSTOM', answeredCount: 10, questionCount: 10 }),
    ).toBe(PREMIUM_CUSTOM_EXAM);
  });

  it('withholds the premium below the answered threshold', () => {
    // 5 of 8 is 62.5%, under PREMIUM_MIN_ANSWERED. The per-question litres are
    // still paid elsewhere - only the completion bonus is withheld.
    expect(
      economyService.priceExamPremium({ kind: 'SIMULATION', answeredCount: 5, questionCount: 8 }),
    ).toBe(0);
  });

  it('pays at exactly the threshold', () => {
    // 7 of 10 is exactly 70% - the gate is >=, not >.
    expect(
      economyService.priceExamPremium({ kind: 'SIMULATION', answeredCount: 7, questionCount: 10 }),
    ).toBe(PREMIUM_EXAM_SIMULATION);
  });

  it('pays nothing for an empty paper rather than dividing by zero', () => {
    expect(
      economyService.priceExamPremium({ kind: 'SIMULATION', answeredCount: 0, questionCount: 0 }),
    ).toBe(0);
  });
});
