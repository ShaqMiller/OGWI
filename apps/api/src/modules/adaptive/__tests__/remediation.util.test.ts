import { describe, expect, it } from 'vitest';
import { deriveRemediationState } from '../remediation.util.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

describe('deriveRemediationState', () => {
  it('is not in remediation when there is no history', () => {
    expect(deriveRemediationState([])).toEqual({
      inRemediation: false,
      enteredAt: null,
      exitedAt: null,
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

  it('requires distinct renderings when both are known', () => {
    const events = [
      { grade: 'AGAIN' as const, reviewedAt: day(1), renderingId: null },
      { grade: 'GOOD' as const, reviewedAt: day(2), renderingId: 'r1' },
      { grade: 'GOOD' as const, reviewedAt: day(3), renderingId: 'r1' },
      { grade: 'GOOD' as const, reviewedAt: day(4), renderingId: 'r2' },
    ];

    const state = deriveRemediationState(events);
    expect(state.inRemediation).toBe(false);
    expect(state.exitedAt).toEqual(day(4));
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
});
