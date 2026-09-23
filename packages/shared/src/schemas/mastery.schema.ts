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
/**
 * A module's state (Doc 2 B1): mastered once its DISPLAYED score reaches the
 * pass mark, relaxing to "due for a refresh" if it decays back below - never
 * "lost", never red - and flipping back on recrossing. A module that has never
 * been mastered is simply still building.
 */
export const moduleStateSchema = z.enum(['building', 'mastered', 'due_for_refresh']);
export type ModuleState = z.infer<typeof moduleStateSchema>;

export const moduleMasterySchema = z.object({
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  liveScore: z.number().min(0).max(1),
  displayedScore: z.number().min(0).max(1),
  state: moduleStateSchema,
});
export type ModuleMastery = z.infer<typeof moduleMasterySchema>;

/**
 * The Biggest Opportunity (Doc 2 B1): the module where effort pays most,
 * "surfaced with impact framing" - hence the exam share and the gap to the
 * pass mark, both as whole percentages.
 */
export const biggestOpportunitySchema = z.object({
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  examSharePercent: z.number().int().min(0).max(100),
  pointsBelowPassMark: z.number().int().min(0).max(100),
});
export type BiggestOpportunity = z.infer<typeof biggestOpportunitySchema>;

/** GET /api/mastery/:slug. Everything here changes only at a publish point. */
export const masteryViewSchema = z.object({
  modules: z.array(moduleMasterySchema),
  passMarkPercent: z.number().int().min(0).max(100),
  biggestOpportunity: biggestOpportunitySchema.nullable(),
});
export type MasteryView = z.infer<typeof masteryViewSchema>;
