import { z } from 'zod';

export const earnedAwardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  thresholdFt: z.number(),
  earnedAt: z.coerce.date().nullable(),
});
export type EarnedAward = z.infer<typeof earnedAwardSchema>;
