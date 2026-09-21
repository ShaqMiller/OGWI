import { z } from 'zod';
import { moduleMasterySchema } from './mastery.schema.js';
import { publishedReadinessSchema } from './readiness.schema.js';

/** What a publish point (session end, practice-run end) publishes: mastery and the odds together. */
export const sessionPublishResultSchema = z.object({
  mastery: z.array(moduleMasterySchema),
  readiness: publishedReadinessSchema,
});
export type SessionPublishResult = z.infer<typeof sessionPublishResultSchema>;
