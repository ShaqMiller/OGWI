import { useQuery } from '@tanstack/react-query';
import type { ModuleMastery } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useMastery(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.mastery.qualification(qualificationSlug),
    queryFn: () => apiClient.get<ModuleMastery[]>(`mastery/${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
