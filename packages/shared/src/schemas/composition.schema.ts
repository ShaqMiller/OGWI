import { z } from 'zod';

/**
 * Session & flow composition (Doc 2 B5), scoped to what's buildable without
 * the systems it would otherwise hand off to (blurting/Teach Oggi - B6/B7 -
 * and the litre economy - B8 - don't exist yet, so this only labels an
 * activity-slot recommendation, it can't run one).
 */

export const activitySlotSchema = z.enum(['blurt', 'teach']).nullable();
export type ActivitySlot = z.infer<typeof activitySlotSchema>;

export const compositionDueItemSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  due: z.coerce.date().nullable(),
  isNew: z.boolean(),
});
export type CompositionDueItem = z.infer<typeof compositionDueItemSchema>;

export const currentTopicSchema = z
  .object({
    topicId: z.string().uuid(),
    topicName: z.string(),
    moduleId: z.string().uuid(),
    moduleName: z.string(),
  })
  .nullable();
export type CurrentTopic = z.infer<typeof currentTopicSchema>;

export const nextSessionSchema = z.object({
  opener: z.array(compositionDueItemSchema),
  currentTopic: currentTopicSchema,
  topicQuizItems: z.array(compositionDueItemSchema),
  activitySlot: activitySlotSchema,
  qualificationComplete: z.boolean(),
});
export type NextSession = z.infer<typeof nextSessionSchema>;
