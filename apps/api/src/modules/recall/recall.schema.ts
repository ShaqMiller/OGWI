import { z } from 'zod';

export const topicParamsSchema = z.object({
  topicId: z.string().uuid(),
});
export type TopicParams = z.infer<typeof topicParamsSchema>;
