import {
  READINESS_HORIZON_CAP_DAYS,
  READINESS_HORIZON_DEFAULT_DAYS,
  READINESS_HORIZON_FLOOR_DAYS,
} from '@ogwi/shared';

/**
 * The spacing horizon (Doc 2 B2): "horizon = clamp(forecast - today, floor 45
 * days, cap 12 months; default 3 months before pace data exists)". It caps how
 * far ahead the scheduler may place a review - there is no point scheduling a
 * question past the day the learner expects to finish the course.
 *
 * Spaced-review scheduling only. It is not a deadline and never shown: nothing
 * expires (invariant 7), and content is never scheduled.
 *
 * The floor keeps reviews from piling up as the forecast shortens near
 * completion; the cap keeps a very slow pace from parking a question years out.
 *
 * Pure.
 */
export function resolveHorizonDays(params: {
  /** The published forecast's finish date, "YYYY-MM-DD", or null with no pace data. */
  expectedFinishDate: string | null;
  now: Date;
}): number {
  if (params.expectedFinishDate === null) return READINESS_HORIZON_DEFAULT_DAYS;

  const finishAt = Date.parse(`${params.expectedFinishDate}T00:00:00.000Z`);
  if (Number.isNaN(finishAt)) return READINESS_HORIZON_DEFAULT_DAYS;

  const days = Math.ceil((finishAt - params.now.getTime()) / (24 * 60 * 60 * 1000));

  return Math.min(READINESS_HORIZON_CAP_DAYS, Math.max(READINESS_HORIZON_FLOOR_DAYS, days));
}
