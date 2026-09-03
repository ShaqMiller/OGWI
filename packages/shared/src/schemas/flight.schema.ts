import { z } from 'zod';

export const flightStateSchema = z.object({
  flightId: z.string().uuid().nullable(),
  fill: z.number().min(0),
  isAirborne: z.boolean(),
  peak: z.number().min(0),
  liftoffAt: z.coerce.date().nullable(),
  justTouchedDown: z.boolean(),
});
export type FlightStateResponse = z.infer<typeof flightStateSchema>;
