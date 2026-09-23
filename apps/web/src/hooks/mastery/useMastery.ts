import { useQuery } from '@tanstack/react-query';
import type { MasteryView } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useMastery(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.mastery.qualification(qualificationSlug),
    queryFn: () => apiClient.get<MasteryView>(`mastery/${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
