import { z } from 'zod';

/** Query params only - response shapes live in packages/shared. */
export const weeklyActivityQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
  /** 0 is the current week; 1 is the week before it, and so on. */
  weeksAgo: z.coerce.number().int().min(0).max(52).default(0),
});
export type WeeklyActivityQuery = z.infer<typeof weeklyActivityQuerySchema>;
