import { z } from 'zod';
import { reviewSourceSchema } from './scheduler.schema.js';

export const remediationStatusSchema = z.enum(['in_remediation', 'recently_exited']);
export type RemediationStatus = z.infer<typeof remediationStatusSchema>;

export const remediationItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  status: remediationStatusSchema,
  enteredAt: z.coerce.date(),
  exitedAt: z.coerce.date().nullable(),
});
export type RemediationItem = z.infer<typeof remediationItemSchema>;

export const gapQueueModuleSchema = z.object({
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  remediationCount: z.number().int().nonnegative(),
  oldestSignalAt: z.coerce.date().nullable(),
  ready: z.boolean(),
  readyDate: z.coerce.date().nullable(),
});
export type GapQueueModule = z.infer<typeof gapQueueModuleSchema>;

/**
 * The remediation record for one item (Doc 2 B3), derived from the review log.
 * `rung` is always null until the format ladder exists - it needs rendering
 * variants that haven't been authored.
 */
export const remediationRecordSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  moduleId: z.string().uuid(),
  moduleName: z.string(),
  status: z.enum(['in_remediation', 'exited']),
  /** Where the miss behind `enteredAt` came from. */
  source: reviewSourceSchema,
  /** The most recent miss - each one resets progress toward exit. */
  enteredAt: z.coerce.date(),
  exitedAt: z.coerce.date().nullable(),
  againCount: z.number().int().positive(),
  qualifyingAnswers: z.array(
    z.object({ reviewedAt: z.coerce.date(), renderingId: z.string().nullable() }),
  ),
  correctAnswersRequired: z.number().int().positive(),
  correctAnswersNeeded: z.number().int().nonnegative(),
  /** When a correct answer will next count toward exit. Null once exited. */
  nextQualifyingFrom: z.coerce.date().nullable(),
  renderingDistinctnessEnforced: z.boolean(),
  rung: z.null(),
});
export type RemediationRecord = z.infer<typeof remediationRecordSchema>;
