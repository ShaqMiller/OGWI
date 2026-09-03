import { z } from 'zod';

export const economyQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
});
export type EconomyQuery = z.infer<typeof economyQuerySchema>;

export const recentEventsQuerySchema = economyQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type RecentEventsQuery = z.infer<typeof recentEventsQuerySchema>;
