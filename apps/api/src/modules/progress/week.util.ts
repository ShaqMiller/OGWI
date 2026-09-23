/**
 * UTC weeks for the Progress page's "This week so far" (Doc 2 A10).
 *
 * Weeks run Monday to Sunday. The spec doesn't name a start day, and no
 * learner timezone exists yet - the same UTC scaffold simplification as the
 * remediation day rule and the daily rollover. B9's "Biggest Day" is the only
 * place the spec puts local days, and that isn't built.
 *
 * Pure.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Week {
  /** Midnight UTC on the Monday. */
  start: Date;
  /** Midnight UTC on the following Monday - exclusive. */
  end: Date;
  /** The week's seven days as "YYYY-MM-DD", Monday first. */
  days: string[];
}

export function weekContaining(now: Date, weeksAgo = 0): Week {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // getUTCDay is 0 on Sunday, so Sunday is 6 days into its Monday-first week.
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;

  const start = new Date(midnight - (daysSinceMonday + weeksAgo * 7) * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);

  return {
    start,
    end,
    days: Array.from({ length: 7 }, (_, offset) => utcDay(new Date(start.getTime() + offset * DAY_MS))),
  };
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
