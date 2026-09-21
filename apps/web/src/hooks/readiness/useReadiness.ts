import { useQuery } from '@tanstack/react-query';
import type { ReadinessView } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useReadiness(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.readiness.qualification(qualificationSlug),
    queryFn: () => apiClient.get<ReadinessView>(`readiness/${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
