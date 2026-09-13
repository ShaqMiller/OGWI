import { z } from 'zod';

/**
 * The honesty split (Doc 2 B1): liveScore is the instant, unsmoothed value
 * (what predictions must read); displayedScore is the published value shown
 * to a learner.
 *
 * displayedScore only changes at a publish point (Doc 2 C4) - session end,
 * practice-run end, exam submit, or the daily rollover - never mid-activity.
 * Between publish points it can sit BELOW live (a gain lands at the next
 * publish) as well as above it (a decline eases over a 7-day half-life). A
 * module that has never been published shows 0.
 */
export const moduleMasterySchema = z.object({
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  liveScore: z.number().min(0).max(1),
  displayedScore: z.number().min(0).max(1),
});
export type ModuleMastery = z.infer<typeof moduleMasterySchema>;
