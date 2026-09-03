import { z } from 'zod';

export const flightQuerySchema = z.object({
  qualificationSlug: z.string().min(1),
});
export type FlightQuery = z.infer<typeof flightQuerySchema>;
