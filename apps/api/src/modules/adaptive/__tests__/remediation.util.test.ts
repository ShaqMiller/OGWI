import { describe, expect, it } from 'vitest';
import { deriveRemediationState } from '../remediation.util.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

describe('deriveRemediationState', () => {
  it('is not in remediation when there is no history', () => {
    expect(deriveRemediationState([])).toEqual({
      inRemediation: false,
      enteredAt: null,
      exitedAt: null,
      againCount: 0,
      qualifyingAnswers: [],
      correctAnswersNeeded: 0,
      nextQualifyingFrom: null,
      renderingDistinctnessEnforced: false,
    });
  });

  it('enters remediation on Again and stays in it until two qualifying corrects land', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
    ];

    const state = deriveRemediationState(events);
    expect(state.inRemediation).toBe(true);
    expect(state.exitedAt).toBeNull();
  });

  it('exits after two corrects on two different days', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: null },
    ];

    const state = deriveRemediationState(events);
    expect(state.inRemediation).toBe(false);
    expect(state.exitedAt).toEqual(day(3));
  });

  it('does not count two corrects on the same day', () => {
    const sameDayMorning = new Date(Date.UTC(2026, 0, 2, 9, 0, 0));
    const sameDayEvening = new Date(Date.UTC(2026, 0, 2, 21, 0, 0));
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: sameDayMorning, renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: sameDayEvening, renderingId: null },
    ];

    expect(deriveRemediationState(events).inRemediation).toBe(true);
  });

  it('requires distinct renderings when the item has more than one', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: 'r1' },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: 'r1' },
      { grade: 'GOOD' as const, reviewedAt: day(4), renderingId: 'r2' },
    ];

    const state = deriveRemediationState(events, { enforceRenderingDistinctness: true });
    expect(state.inRemediation).toBe(false);
    // day(3) is skipped as a repeat of r1; r2 on day(4) is what exits it.
    expect(state.exitedAt).toEqual(day(4));
  });

  /**
   * Regression for the deadlock this option exists to prevent. Every item in
   * the content graph currently has exactly one BASE rendering, so once
   * answers started recording which rendering was served, both qualifying
   * Goods necessarily carried the same id. With distinctness enforced
   * unconditionally the second is skipped forever, the item never leaves
   * remediation, and Practice's "Fixing gaps" grows without bound.
   *
   * Re-enable enforcement by authoring rendering variants, not by deleting
   * this test.
   */
  it('exits on two Goods on different days when the item has only one rendering', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: 'only-rendering' },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: 'only-rendering' },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: 'only-rendering' },
    ];

    const state = deriveRemediationState(events, { enforceRenderingDistinctness: false });
    expect(state.inRemediation).toBe(false);
    expect(state.exitedAt).toEqual(day(3));
  });

  it('a later Again resets progress even after partial remediation success', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'AGAIN' as const, reviewedAt: day(3), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(4), renderingId: null },
    ];

    const state = deriveRemediationState(events);
    expect(state.inRemediation).toBe(true);
    expect(state.enteredAt).toEqual(day(3));
  });

  it('re-enters remediation on Again after a prior exit', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: null },
      { grade: 'AGAIN' as const, reviewedAt: day(10), renderingId: null },
    ];

    const state = deriveRemediationState(events);
    expect(state.inRemediation).toBe(true);
    expect(state.enteredAt).toEqual(day(10));
  });

  it('reports progress toward exit, and when the next correct answer can count', () => {
    const missed = new Date(Date.UTC(2026, 0, 1, 9, 0, 0));
    const firstCorrect = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));
    const sameDayCorrect = new Date(Date.UTC(2026, 0, 1, 21, 0, 0));

    const justMissed = deriveRemediationState([
      { grade: 'AGAIN' as const, reviewedAt: missed, renderingId: null },
    ]);
    expect(justMissed.correctAnswersNeeded).toBe(2);
    // A correct answer counts straight away after a miss.
    expect(justMissed.nextQualifyingFrom).toEqual(missed);

    const halfway = deriveRemediationState([
      { grade: 'AGAIN' as const, reviewedAt: missed, renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: firstCorrect, renderingId: 'r1' },
      { grade: 'GOOD' as const, reviewedAt: sameDayCorrect, renderingId: 'r1' },
    ]);
    expect(halfway.qualifyingAnswers).toEqual([
      { reviewedAt: firstCorrect, day: '2026-01-01', renderingId: 'r1' },
    ]);
    expect(halfway.correctAnswersNeeded).toBe(1);
    expect(halfway.nextQualifyingFrom).toEqual(new Date(Date.UTC(2026, 0, 2, 0, 0, 0)));
  });

  it('reports nothing left to do once exited', () => {
    const state = deriveRemediationState([
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: null },
    ]);

    expect(state.correctAnswersNeeded).toBe(0);
    expect(state.nextQualifyingFrom).toBeNull();
    expect(state.qualifyingAnswers).toHaveLength(2);
  });

  it('counts repeat misses within an episode, and starts again after an exit', () => {
    const stillIn = deriveRemediationState([
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'AGAIN' as const, reviewedAt: day(3), renderingId: null },
    ]);
    expect(stillIn.againCount).toBe(2);

    const reEntered = deriveRemediationState([
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'AGAIN' as const, reviewedAt: day(2), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(4), renderingId: null },
      { grade: 'AGAIN' as const, reviewedAt: day(10), renderingId: null },
    ]);
    expect(reEntered.againCount).toBe(1);
  });

  it('says whether rendering distinctness applied', () => {
    const events = [{ grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null }];

    expect(deriveRemediationState(events, { enforceRenderingDistinctness: true }).renderingDistinctnessEnforced).toBe(true);
    expect(deriveRemediationState(events).renderingDistinctnessEnforced).toBe(false);
  });
});
