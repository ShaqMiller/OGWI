import { z } from 'zod';
import { masteryViewSchema } from './mastery.schema.js';
import { publishedReadinessSchema } from './readiness.schema.js';

/**
 * What caused a publish point. Only the rollover happens without the learner
 * doing something, which is what makes the other two countable as sessions.
 */
export const publishTriggerSchema = z.enum(['session', 'exam', 'rollover']);
export type PublishTrigger = z.infer<typeof publishTriggerSchema>;

/** What a publish point (session end, practice-run end) publishes: mastery and the odds together. */
export const sessionPublishResultSchema = z.object({
  mastery: masteryViewSchema,
  readiness: publishedReadinessSchema,
});
export type SessionPublishResult = z.infer<typeof sessionPublishResultSchema>;
