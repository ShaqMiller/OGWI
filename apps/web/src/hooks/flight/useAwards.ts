import { useQuery } from '@tanstack/react-query';
import type { EarnedAward } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useAwards() {
  return useQuery({
    queryKey: queryKeys.flight.awards(),
    queryFn: () => apiClient.get<EarnedAward[]>('flight/awards'),
  });
}
