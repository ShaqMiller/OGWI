import { useQuery } from '@tanstack/react-query';
import type { Qualification } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useQualifications() {
  return useQuery({
    queryKey: queryKeys.contentGraph.qualifications(),
    queryFn: () => apiClient.get<Qualification[]>('content-graph/qualifications'),
  });
}
