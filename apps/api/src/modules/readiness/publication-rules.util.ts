import {
  READINESS_CELEBRATION_MIN_BAND,
  READINESS_CELEBRATION_THRESHOLD,
  READINESS_FORECAST_FREEZE_QUIET_DAYS,
  type CertaintyBand,
} from '@ogwi/shared';
import { CERTAINTY_BAND_RANK } from './next-action.util.js';

/**
 * Rules that depend on what was published before, applied at publish time.
 * Pure: the caller supplies the history.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The readiness celebration (Doc 2 B2): "Fires once, on a rising crossing of
 * 80% odds with certainty Fair or better: 'You'd very likely pass if you sat
 * it soon.' Later dips trigger nothing - no alarm, no retraction."
 *
 * A first-ever score already at 80% counts as a rising crossing: from no
 * number to above the line.
 */
export function decideCelebration(params: {
  unlocked: boolean;
  oddsRaw: number;
  certaintyBand: CertaintyBand;
  previous: { unlocked: boolean; oddsRaw: number } | null;
  alreadyCelebrated: boolean;
}): boolean {
  if (!params.unlocked || params.alreadyCelebrated) return false;
  if (params.oddsRaw < READINESS_CELEBRATION_THRESHOLD) return false;
  if (CERTAINTY_BAND_RANK[params.certaintyBand] < CERTAINTY_BAND_RANK[READINESS_CELEBRATION_MIN_BAND]) {
    return false;
  }

  const wasBelow =
    params.previous === null ||
    !params.previous.unlocked ||
    params.previous.oddsRaw < READINESS_CELEBRATION_THRESHOLD;

  return wasBelow;
}

/**
 * The forecast (Doc 2 B2): "after 14+ fully quiet days it freezes at its last
 * value" - so a learner on a break sees the date they were heading for, not a
 * pace of zero pushing it off the calendar. A10: "picks back up when you do."
 * Quiet means no answers at all; a learner who has never answered has nothing
 * to freeze.
 */
export function isForecastFrozen(params: { lastReviewedAt: Date | null; now: Date }): boolean {
  if (params.lastReviewedAt === null) return false;
  return params.now.getTime() - params.lastReviewedAt.getTime() >= READINESS_FORECAST_FREEZE_QUIET_DAYS * DAY_MS;
}
