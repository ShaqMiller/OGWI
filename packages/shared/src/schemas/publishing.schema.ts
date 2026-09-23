import { z } from 'zod';
import { masteryViewSchema } from './mastery.schema.js';
import { publishedReadinessSchema } from './readiness.schema.js';

/** What a publish point (session end, practice-run end) publishes: mastery and the odds together. */
export const sessionPublishResultSchema = z.object({
  mastery: masteryViewSchema,
  readiness: publishedReadinessSchema,
});
export type SessionPublishResult = z.infer<typeof sessionPublishResultSchema>;
