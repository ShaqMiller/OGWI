import { z } from 'zod';
import { MAX_CLOCK_ADVANCE_SECONDS } from '../constants/dev.constants.js';

/** A demo learner's clock: how far ahead of real time it runs, and what time that makes it. */
export const devClockSchema = z.object({
  learnerId: z.string(),
  offsetSeconds: z.number().int().min(0),
  now: z.coerce.date(),
});
export type DevClock = z.infer<typeof devClockSchema>;

/** Forward-only: a clock that moved back would stamp new rows before ones already written. */
export const advanceClockRequestSchema = z.object({
  seconds: z.number().int().positive().max(MAX_CLOCK_ADVANCE_SECONDS),
});
export type AdvanceClockRequest = z.infer<typeof advanceClockRequestSchema>;

export const resetDemoLearnerResponseSchema = z.object({
  learnerId: z.string(),
  deleted: z.record(z.string(), z.number().int().min(0)),
});
export type ResetDemoLearnerResponse = z.infer<typeof resetDemoLearnerResponseSchema>;
