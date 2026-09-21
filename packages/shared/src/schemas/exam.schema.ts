import { z } from 'zod';
import { renderingFormatSchema } from './content-graph.schema.js';

/**
 * Exam runs (Doc 2 A5 / A5A). Exam mode contains no aid machinery
 * (invariant 10), and the shapes here are the main structural expression of
 * that: examQuestionSchema has no field capable of carrying a correct answer,
 * and saving a selection returns nothing about it.
 *
 * The answer key appears in exactly one shape - examResultQuestionSchema,
 * served only after the run is submitted.
 */

export const examRunKindSchema = z.enum(['SIMULATION', 'MINI_MOCK', 'CUSTOM']);
export type ExamRunKind = z.infer<typeof examRunKindSchema>;

/** The kinds a learner can start. CUSTOM waits for the test builder. */
export const startableExamRunKindSchema = z.enum(['SIMULATION', 'MINI_MOCK']);
export type StartableExamRunKind = z.infer<typeof startableExamRunKindSchema>;

export const examRunStatusSchema = z.enum(['IN_PROGRESS', 'SUBMITTED']);
export type ExamRunStatus = z.infer<typeof examRunStatusSchema>;

export const startExamRunRequestSchema = z.object({
  qualificationSlug: z.string().min(1),
  kind: startableExamRunKindSchema.default('SIMULATION'),
});
/** The request as sent - `kind` may be omitted, and then means a full simulation. */
export type StartExamRunRequest = z.input<typeof startExamRunRequestSchema>;

export const startExamRunResponseSchema = z.object({
  runId: z.string().uuid(),
  kind: examRunKindSchema,
  /** The paper's REAL size, which may be below the target when content is thin. */
  questionCount: z.number().int().positive(),
  allottedSeconds: z.number().int().positive(),
});
export type StartExamRunResponse = z.infer<typeof startExamRunResponseSchema>;

/**
 * One question as served during a run. Deliberately carries no correctness
 * information of any kind - not the key, not a marker, not a hint.
 */
export const examQuestionSchema = z.object({
  position: z.number().int().nonnegative(),
  knowledgeItemId: z.string().uuid(),
  renderingId: z.string().uuid(),
  format: renderingFormatSchema,
  prompt: z.string(),
  options: z.array(z.string()),
  /** The learner's own saved selection, so a reload restores their work. */
  selectedOptionIndex: z.number().int().nonnegative().nullable(),
});
export type ExamQuestion = z.infer<typeof examQuestionSchema>;

export const examPaperSchema = z.object({
  runId: z.string().uuid(),
  qualificationSlug: z.string().min(1),
  qualificationName: z.string().min(1),
  kind: examRunKindSchema,
  status: examRunStatusSchema,
  questionCount: z.number().int().positive(),
  allottedSeconds: z.number().int().positive(),
  startedAt: z.coerce.date(),
  questions: z.array(examQuestionSchema),
});
export type ExamPaper = z.infer<typeof examPaperSchema>;

export const saveExamAnswerRequestSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  selectedOptionIndex: z.number().int().nonnegative(),
});
export type SaveExamAnswerRequest = z.infer<typeof saveExamAnswerRequestSchema>;

/** Acknowledgement only. Saving an answer never reveals whether it was right. */
export const saveExamAnswerResponseSchema = z.object({ saved: z.literal(true) });
export type SaveExamAnswerResponse = z.infer<typeof saveExamAnswerResponseSchema>;

/** One question on the results screen - Doc 2 A5A's "Review Answers". */
export const examResultQuestionSchema = z.object({
  position: z.number().int().nonnegative(),
  knowledgeItemId: z.string().uuid(),
  prompt: z.string(),
  options: z.array(z.string()),
  selectedOptionIndex: z.number().int().nonnegative().nullable(),
  correctOptionIndex: z.number().int().nonnegative(),
  /** null when the question was left unanswered - not the same as being wrong. */
  correct: z.boolean().nullable(),
  /** Where this came from, per A5A ("the source topic/lesson/objective"). */
  topicName: z.string(),
  moduleName: z.string(),
  explanation: z.string().nullable(),
});
export type ExamResultQuestion = z.infer<typeof examResultQuestionSchema>;

/**
 * Deliberately carries no attempt number, attempt count, previous score or
 * comparison of any kind - invariant 12 and Doc 2 A13 ("attempt counts are
 * never displayed anywhere"). Mock scores are private forever (A5).
 */
export const examResultsSchema = z.object({
  runId: z.string().uuid(),
  qualificationSlug: z.string().min(1),
  qualificationName: z.string().min(1),
  kind: examRunKindSchema,
  correctCount: z.number().int().nonnegative(),
  scoredCount: z.number().int().positive(),
  scorePercent: z.number().min(0).max(100),
  passMarkPercent: z.number().min(0).max(100),
  passed: z.boolean(),
  answeredCount: z.number().int().nonnegative(),
  allottedSeconds: z.number().int().positive(),
  /** Honest even when it exceeds the allotment; there is no penalty. */
  secondsUsed: z.number().int().nonnegative(),
  /**
   * What the run actually paid: the per-question litres plus the completion
   * premium. Doc 2 B8 has exam litres "accrue silently and pay at the feedback
   * screen", so this is the first moment the learner sees them.
   */
  litresEarned: z.number().int().nonnegative(),
  questions: z.array(examResultQuestionSchema),
});
export type ExamResults = z.infer<typeof examResultsSchema>;
