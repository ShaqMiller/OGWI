import { useQuery } from '@tanstack/react-query';
import type { RemediationItem } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useWrongAnswerPool(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.adaptive.wrongAnswerPool(qualificationSlug),
    queryFn: () =>
      apiClient.get<RemediationItem[]>(
        `adaptive/wrong-answer-pool?qualificationSlug=${qualificationSlug}`,
      ),
    enabled: Boolean(qualificationSlug),
  });
}
