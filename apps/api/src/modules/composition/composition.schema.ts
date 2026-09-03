import { z } from 'zod';

export const nextSessionQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
});
export type NextSessionQuery = z.infer<typeof nextSessionQuerySchema>;
