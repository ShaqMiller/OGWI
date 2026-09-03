import { describe, expect, it } from 'vitest';
import { replayFlightState } from '../flight-state.util.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + n * 24 * 60 * 60 * 1000);

describe('replayFlightState', () => {
  it('accumulates grounded pumps leak-free, no decay before liftoff', () => {
    const state = replayFlightState(
      [
        { amount: 30, effectiveAt: day(0) },
        { amount: 30, effectiveAt: day(5) }, // a big gap - no leak, still grounded
      ],
      day(10),
    );

    expect(state.fill).toBe(60);
    expect(state.isAirborne).toBe(false);
    expect(state.liftoffAt).toBeNull();
  });

  it('marks liftoff the instant a pump crosses 100ft', () => {
    const state = replayFlightState(
      [
        { amount: 60, effectiveAt: day(0) },
        { amount: 50, effectiveAt: day(0.1) },
      ],
      day(0.1),
    );

    expect(state.fill).toBe(110);
    expect(state.isAirborne).toBe(true);
    expect(state.liftoffAt).toEqual(day(0.1));
  });

  it('decays between pumps once airborne, and from the last pump to now', () => {
    const state = replayFlightState(
      [{ amount: 400, effectiveAt: day(0) }], // airborne immediately
      day(1),
    );

    expect(state.fill).toBeCloseTo(200, 5); // halved after 24h at/above 200ft
    expect(state.isAirborne).toBe(true);
  });

  it('tracks peak as the running max at pump instants, not the decayed-to value', () => {
    const state = replayFlightState([{ amount: 500, effectiveAt: day(0) }], day(3));

    expect(state.peak).toBe(500);
    expect(state.fill).toBeLessThan(500);
  });

  it('caps fill at the altitude ceiling', () => {
    const state = replayFlightState(
      [
        { amount: 900, effectiveAt: day(0) },
        { amount: 900, effectiveAt: day(0) },
      ],
      day(0),
    );

    expect(state.fill).toBe(1000);
    expect(state.peak).toBe(1000);
  });
});
