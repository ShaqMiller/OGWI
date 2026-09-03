import { z } from 'zod';

export const adaptiveQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
});
export type AdaptiveQuery = z.infer<typeof adaptiveQuerySchema>;
