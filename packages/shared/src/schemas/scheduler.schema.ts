import { z } from 'zod';

/**
 * Binary grading only (Doc 2 B4: "binary right/wrong grading ... is
 * slightly more accurate for this grading style than mixed grading"). The
 * four-rating FSRS scale (Again/Hard/Good/Easy) exists in the library but
 * this product only ever uses two of them.
 */
export const reviewGradeSchema = z.enum(['again', 'good']);
export type ReviewGradeInput = z.infer<typeof reviewGradeSchema>;

/**
 * What a learner submits. Discriminated on the *answer shape*, not on the
 * rendering format: the ten formats in renderingFormatSchema collapse to
 * roughly four shapes (MULTIPLE_CHOICE, TRUE_FALSE and PICK_AN_IMAGE all
 * submit one option index; MULTIPLE_RESPONSE submits several;
 * TYPED_SHORT_ANSWER submits text). Keying on shape keeps the union small
 * instead of tracking the format enum one-for-one.
 *
 * One member today. It is a union anyway because the request body is the
 * expensive place to make a breaking change later - the response side can
 * grow additively, so it stays flat.
 */
export const submittedAnswerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('option_index'),
    selectedOptionIndex: z.number().int().nonnegative(),
  }),
]);
export type SubmittedAnswer = z.infer<typeof submittedAnswerSchema>;

/**
 * POST /api/scheduler/answers. Replaces the old POST /api/scheduler/reviews,
 * which took a client-computed `grade` and therefore trusted the browser to
 * mark its own work - see docs/BUILD_ORDER.md step 4.
 *
 * `renderingId` is required, not optional: the server verifies it belongs to
 * `knowledgeItemId` before writing anything, and records it on the
 * ReviewEvent so the adaptive engine knows which rendering was answered.
 */
export const submitAnswerRequestSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  renderingId: z.string().uuid(),
  answer: submittedAnswerSchema,
});
export type SubmitAnswerRequest = z.infer<typeof submitAnswerRequestSchema>;

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

/**
 * The response to a submitted answer. This is the only place the correct
 * answer is ever disclosed, and only after the learner has committed to one.
 *
 * `grade` is derived server-side from `correct` - it is reported back so the
 * client can explain what was written to the learner's memory state, not so
 * it can choose it.
 */
export const submitAnswerResponseSchema = z.object({
  correct: z.boolean(),
  grade: reviewGradeSchema,
  correctOptionIndex: z.number().int().nonnegative(),
  memoryState: itemMemoryStateSchema,
});
export type SubmitAnswerResponse = z.infer<typeof submitAnswerResponseSchema>;
