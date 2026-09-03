import {
  LINEAR_LEAK_PER_DAY_FT,
  PROPORTIONAL_LEAK_THRESHOLD_FT,
} from '@ogwi/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The one place decay maths exists (Doc 2 B9). A pure function: given a
 * fill at a known instant, what is it at a later instant? Grounded fill
 * (< liftoff threshold) never calls this - "ground is leak-free" - this
 * models airborne decay only.
 *
 * At/above 200ft, fill halves every 24h (exponential); below 200ft, it
 * drains linearly at a fixed rate/day. A starting fill above 200 that
 * would decay through the boundary is evaluated piecewise: exponential
 * until the exact crossing instant, then linear for the remainder -
 * matching the spec's closed-form t_c = 24h * log2(fill0/200).
 */
export function evaluateFill(fill0: number, t0: Date, t: Date): number {
  const elapsedDays = Math.max(0, (t.getTime() - t0.getTime()) / DAY_MS);
  if (elapsedDays === 0) return fill0;

  if (fill0 <= PROPORTIONAL_LEAK_THRESHOLD_FT) {
    return Math.max(0, fill0 - LINEAR_LEAK_PER_DAY_FT * elapsedDays);
  }

  const daysUntilCrossing = Math.log2(fill0 / PROPORTIONAL_LEAK_THRESHOLD_FT);

  if (elapsedDays <= daysUntilCrossing) {
    return fill0 * Math.pow(0.5, elapsedDays);
  }

  const remainingDaysAfterCrossing = elapsedDays - daysUntilCrossing;
  return Math.max(
    0,
    PROPORTIONAL_LEAK_THRESHOLD_FT - LINEAR_LEAK_PER_DAY_FT * remainingDaysAfterCrossing,
  );
}
