import { z } from 'zod';
import { keyPointTierSchema } from './content-graph.schema.js';

/**
 * Blurting and Teach Oggi are "one fair marker wearing two costumes" per
 * Doc 2 B6/B7 - they share a rubric of key points. This schema backs both.
 * Scoring here is a placeholder for real AI/semantic marking - see
 * apps/api/src/modules/recall/recall.service.ts.
 */

export const topicKeyPointSchema = z.object({
  id: z.string().uuid(),
  plainName: z.string(),
  cueQuestion: z.string(),
  tier: keyPointTierSchema,
});
export type TopicKeyPoint = z.infer<typeof topicKeyPointSchema>;

export const topicKeyPointsResponseSchema = z.object({
  topicName: z.string().nullable(),
  keyPoints: z.array(topicKeyPointSchema),
});
export type TopicKeyPointsResponse = z.infer<typeof topicKeyPointsResponseSchema>;

export const scoreTextRequestSchema = z.object({
  text: z.string().min(1),
});
export type ScoreTextRequest = z.infer<typeof scoreTextRequestSchema>;

export const scoreTextResponseSchema = z.object({
  coverage: z.number().min(0).max(100),
  matched: z.array(topicKeyPointSchema),
  unmatched: z.array(topicKeyPointSchema),
});
export type ScoreTextResponse = z.infer<typeof scoreTextResponseSchema>;
