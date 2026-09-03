import { useQuery } from '@tanstack/react-query';
import type { EconomyBalance } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useEconomyBalance(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.economy.balance(qualificationSlug),
    queryFn: () =>
      apiClient.get<EconomyBalance>(`economy/balance?qualificationSlug=${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
