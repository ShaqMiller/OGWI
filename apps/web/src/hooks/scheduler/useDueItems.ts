import { useQuery } from '@tanstack/react-query';
// CompositionDueItem is the same { knowledgeItemId, due, isNew } shape the
// scheduler's /due endpoint returns - reused rather than duplicated.
import type { CompositionDueItem } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useDueItems(qualificationSlug: string, limit = 20) {
  return useQuery({
    queryKey: queryKeys.scheduler.due(qualificationSlug),
    queryFn: () =>
      apiClient.get<CompositionDueItem[]>(
        `scheduler/due?qualificationSlug=${qualificationSlug}&limit=${limit}`,
      ),
    enabled: Boolean(qualificationSlug),
  });
}
