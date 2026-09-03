import { describe, expect, it } from 'vitest';
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
