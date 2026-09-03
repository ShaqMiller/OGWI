import { useQuery } from '@tanstack/react-query';
import type { KnowledgeItemPrompt } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useKnowledgeItemPrompt(knowledgeItemId: string | null) {
  return useQuery({
    queryKey: queryKeys.contentGraph.knowledgeItem(knowledgeItemId ?? ''),
    queryFn: () =>
      apiClient.get<KnowledgeItemPrompt>(`content-graph/knowledge-items/${knowledgeItemId}`),
    enabled: Boolean(knowledgeItemId),
  });
}
