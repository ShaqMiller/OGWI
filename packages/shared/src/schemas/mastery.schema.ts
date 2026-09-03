import { z } from 'zod';

/**
 * The honesty split (Doc 2 B1): liveScore is the instant, unsmoothed value
 * (what predictions must read); displayedScore is the kind-but-honest
 * published value shown to a learner, which only ever sits at-or-above
 * liveScore.
 */
export const moduleMasterySchema = z.object({
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  liveScore: z.number().min(0).max(1),
  displayedScore: z.number().min(0).max(1),
});
export type ModuleMastery = z.infer<typeof moduleMasterySchema>;
