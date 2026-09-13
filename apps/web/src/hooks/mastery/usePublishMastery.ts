import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ModuleMastery } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * A publish point (Doc 2 C4): session end or practice-run end. This is the only
 * way the browser moves displayed mastery - answering never does. Exam submit
 * publishes server-side, and the daily rollover happens on read.
 */
export function usePublishMastery(qualificationSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<ModuleMastery[]>(`mastery/${qualificationSlug}/publish`),
    onSuccess: (mastery) => {
      queryClient.setQueryData(queryKeys.mastery.qualification(qualificationSlug), mastery);
    },
  });
}
