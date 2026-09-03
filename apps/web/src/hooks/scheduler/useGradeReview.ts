import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GradeReviewRequest } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Every graded answer changes mastery, the recommended next session and
 * the points balance (Doc 2 Part C4's publish-point idea, informally: a
 * graded answer is exactly the kind of moment that should refresh those
 * three). Scoped invalidation via the query-key factory, not a blanket
 * refetch-everything.
 */
export function useGradeReview(qualificationSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: GradeReviewRequest) => apiClient.post('scheduler/reviews', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mastery.qualification(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.composition.next(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.economy.balance(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.economy.recent(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.due(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.adaptive.wrongAnswerPool(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.flight.state(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.readiness.qualification(qualificationSlug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.flight.awards() });
    },
  });
}
