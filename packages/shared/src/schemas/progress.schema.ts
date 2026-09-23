import { z } from 'zod';

/**
 * The Progress page's "This week so far" (Doc 2 A10): litres per day for one
 * Monday-to-Sunday week, plus the week's summary. Days with nothing earned are
 * simply empty.
 */
export const weeklyActivitySchema = z.object({
  /** Monday, as "YYYY-MM-DD" (UTC). */
  weekStart: z.string(),
  isCurrentWeek: z.boolean(),
  days: z.array(z.object({ date: z.string(), litres: z.number().int().nonnegative() })).length(7),
  totals: z.object({
    litres: z.number().int().nonnegative(),
    answers: z.number().int().nonnegative(),
    /** Publish points the learner caused - everything but the daily rollover. */
    sessions: z.number().int().nonnegative(),
    topicsCompleted: z.number().int().nonnegative(),
  }),
});
export type WeeklyActivity = z.infer<typeof weeklyActivitySchema>;
