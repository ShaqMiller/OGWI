import { z } from 'zod';

/**
 * Binary grading only (Doc 2 B4: "binary right/wrong grading ... is
 * slightly more accurate for this grading style than mixed grading"). The
 * four-rating FSRS scale (Again/Hard/Good/Easy) exists in the library but
 * this product only ever uses two of them.
 */
export const reviewGradeSchema = z.enum(['again', 'good']);
export type ReviewGradeInput = z.infer<typeof reviewGradeSchema>;

export const gradeReviewRequestSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  grade: reviewGradeSchema,
  renderingId: z.string().uuid().nullable().optional(),
});
export type GradeReviewRequest = z.infer<typeof gradeReviewRequestSchema>;

export const schedulerCardStateSchema = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export type SchedulerCardStateValue = z.infer<typeof schedulerCardStateSchema>;

export const itemMemoryStateSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  difficulty: z.number(),
  stability: z.number(),
  due: z.coerce.date(),
  lastReviewedAt: z.coerce.date().nullable(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: schedulerCardStateSchema,
});
export type ItemMemoryState = z.infer<typeof itemMemoryStateSchema>;
