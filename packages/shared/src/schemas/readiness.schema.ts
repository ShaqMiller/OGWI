import { z } from 'zod';

export const certaintyBandSchema = z.enum(['early', 'fair', 'solid']);
export type CertaintyBand = z.infer<typeof certaintyBandSchema>;

/** One exam run's contribution to calibration. */
export const calibrationRunSchema = z.object({
  submittedAt: z.coerce.date(),
  achievedScore: z.number().min(0).max(1),
  /** The projection when the run was submitted, before its own answers were graded. */
  projectedScore: z.number().min(0).max(1),
  /** achieved / projected. Null when the projection was too small to divide by. */
  ratio: z.number().nullable(),
  weight: z.number().min(0),
});
export type CalibrationRun = z.infer<typeof calibrationRunSchema>;

/**
 * One candidate for the next action (Doc 2 B2), with its simulated effect:
 * the change in P(pass), the certainty-band steps gained, and the combined
 * score the winner is chosen by.
 */
export const nextActionSchema = z.object({
  kind: z.enum(['refresh', 'biggest_opportunity', 'mini_mock']),
  line: z.string(),
  oddsDelta: z.number(),
  bandSteps: z.number().int(),
  score: z.number(),
});
export type NextAction = z.infer<typeof nextActionSchema>;

/** sigma's four ingredients, each in exam-score units - see readiness/sigma.util.ts. */
export const sigmaComponentsSchema = z.object({
  coverage: z.number().nonnegative(),
  evidence: z.number().nonnegative(),
  spread: z.number().nonnegative(),
  residual: z.number().nonnegative(),
});
export type SigmaComponents = z.infer<typeof sigmaComponentsSchema>;

/**
 * Every ingredient of the odds (Doc 2 B2), so the number can be walked through
 * piece by piece: projection, calibration ratio, calibrated score, sigma, pass
 * mark. All as 0-1 fractions.
 */
export const readinessBreakdownSchema = z.object({
  projectedScore: z.number().min(0).max(1),
  /** The clamped ratio actually applied; 1.0 with no usable runs. */
  calibrationRatio: z.number(),
  /** The unclamped recency-weighted mean, or null with no usable runs. */
  meanRatio: z.number().nullable(),
  calibratedScore: z.number().min(0).max(1),
  sigma: z.number().positive(),
  /** Null only on publications made before sigma had components. */
  sigmaComponents: sigmaComponentsSchema.nullable(),
  passMark: z.number().min(0).max(1),
  /** P(pass) before rounding or withholding. */
  oddsRaw: z.number().min(0).max(1),
  calibrationRuns: z.array(calibrationRunSchema),
  /** Every next-action candidate as simulated. Null on publications made before them. */
  nextActionCandidates: z.array(nextActionSchema).nullable(),
});
export type ReadinessBreakdown = z.infer<typeof readinessBreakdownSchema>;

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
    /** True after 14+ fully quiet days: held at its last value until the learner answers again. */
    frozen: z.boolean(),
  }),
  /** One plain line naming what would help most, or null when nothing would. */
  nextAction: nextActionSchema.nullable(),
  breakdown: readinessBreakdownSchema,
});
export type ReadinessResult = z.infer<typeof readinessResultSchema>;

/** One item of the first-score unlock checklist (Doc 2 B2). */
export const unlockChecklistItemSchema = z.object({
  key: z.enum(['first_topic', 'modules', 'first_exam_run']),
  current: z.number().int().nonnegative(),
  required: z.number().int().positive(),
  done: z.boolean(),
});
export type UnlockChecklistItem = z.infer<typeof unlockChecklistItemSchema>;

export const unlockChecklistSchema = z.object({
  unlocked: z.boolean(),
  items: z.array(unlockChecklistItemSchema),
});
export type UnlockChecklist = z.infer<typeof unlockChecklistSchema>;

/**
 * The odds as published at a publish point. While `unlocked` is false the
 * checklist wasn't complete and `oddsPercent` is null - no score exists yet.
 */
export const publishedReadinessSchema = readinessResultSchema.extend({
  unlocked: z.boolean(),
  /** The first publication ever to carry a score - time for the reveal copy. */
  firstScore: z.boolean(),
  /** This publication crossed 80% and fired the one-time celebration. */
  celebrate: z.boolean(),
  /**
   * The spacing horizon in days: how far ahead the scheduler may place a
   * review until the next publication. Scheduling only - never a deadline.
   */
  horizonDays: z.number().int().positive(),
  publishedAt: z.coerce.date(),
});
export type PublishedReadiness = z.infer<typeof publishedReadinessSchema>;

/**
 * GET /api/readiness/:slug. The checklist is live - it ticks as items are
 * earned. The odds are the latest publication, or null before any publish
 * point has been reached.
 */
export const readinessViewSchema = z.object({
  checklist: unlockChecklistSchema,
  published: publishedReadinessSchema.nullable(),
});
export type ReadinessView = z.infer<typeof readinessViewSchema>;
