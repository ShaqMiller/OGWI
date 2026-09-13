import { z } from 'zod';

export const dueItemsQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
  limit: z.coerce.number().int().positive().max(50).default(8),
});
export type DueItemsQuery = z.infer<typeof dueItemsQuerySchema>;

export const reviewLogQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type ReviewLogQuery = z.infer<typeof reviewLogQuerySchema>;
