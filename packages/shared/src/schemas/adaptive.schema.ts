import { z } from 'zod';

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
