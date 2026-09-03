import { useQuery } from '@tanstack/react-query';
import type { ReadinessResult } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useReadiness(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.readiness.qualification(qualificationSlug),
    queryFn: () => apiClient.get<ReadinessResult>(`readiness/${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
