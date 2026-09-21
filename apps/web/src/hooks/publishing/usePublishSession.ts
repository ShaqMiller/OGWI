import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionPublishResult } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * A publish point (Doc 2 C4): session end or practice-run end. Publishes
 * mastery and the odds of passing together. This is the only way the browser
 * moves either - answering never does. Exam submit publishes server-side, and
 * the daily rollover happens on read.
 */
export function usePublishSession(qualificationSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<SessionPublishResult>(`publishing/${qualificationSlug}`),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.mastery.qualification(qualificationSlug), result.mastery);
      // The readiness view also carries the live unlock checklist, so refetch
      // it whole rather than patching in the published half.
      queryClient.invalidateQueries({ queryKey: queryKeys.readiness.qualification(qualificationSlug) });
    },
  });
}
