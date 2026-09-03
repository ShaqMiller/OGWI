import { z } from 'zod';

export const getQualificationParamsSchema = z.object({
  slug: z.string().min(1),
});
export type GetQualificationParams = z.infer<typeof getQualificationParamsSchema>;

export const getKnowledgeItemParamsSchema = z.object({
  id: z.string().uuid(),
});
export type GetKnowledgeItemParams = z.infer<typeof getKnowledgeItemParamsSchema>;
