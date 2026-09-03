import { z } from 'zod';

export const certaintyBandSchema = z.enum(['early', 'fair', 'solid']);
export type CertaintyBand = z.infer<typeof certaintyBandSchema>;

export const readinessResultSchema = z.object({
  oddsPercent: z.number().min(0).max(100).nullable(),
  withheld: z.boolean(),
  weightedCoveragePercent: z.number().min(0).max(100),
  certaintyBand: certaintyBandSchema,
  passMarkPercent: z.number().min(0).max(100),
  qualityRatio: z.number(),
  celebrationEligible: z.boolean(),
  forecast: z.object({
    expectedFinishDate: z.string().nullable(),
    itemsRemaining: z.number().int().nonnegative(),
    paceItemsPerDay: z.number().nonnegative(),
  }),
});
export type ReadinessResult = z.infer<typeof readinessResultSchema>;
