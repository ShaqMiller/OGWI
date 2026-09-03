import { z } from 'zod';

/** Path params only - request bodies live in packages/shared. */
export const examRunParamsSchema = z.object({
  runId: z.string().uuid(),
});
export type ExamRunParams = z.infer<typeof examRunParamsSchema>;
