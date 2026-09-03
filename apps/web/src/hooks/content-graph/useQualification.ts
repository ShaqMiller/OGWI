import { useQuery } from '@tanstack/react-query';
import type { Qualification } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useQualification(slug: string) {
  return useQuery({
    queryKey: queryKeys.contentGraph.qualification(slug),
    queryFn: () => apiClient.get<Qualification>(`content-graph/qualifications/${slug}`),
    enabled: Boolean(slug),
  });
}
