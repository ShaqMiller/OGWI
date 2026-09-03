import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from '@ogwi/shared';
import { ApiError, apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Submits an answer for marking. Replaces useGradeReview, which decided
 * correctness in the browser and posted the verdict - the server now marks
 * the answer and only then tells us whether it was right.
 *
 * Every graded answer changes mastery, the recommended next session and
 * the points balance (Doc 2 Part C4's publish-point idea, informally: a
 * graded answer is exactly the kind of moment that should refresh those
 * three). Scoped invalidation via the query-key factory, not a blanket
 * refetch-everything.
 */
export function useSubmitAnswer(qualificationSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SubmitAnswerRequest) =>
      apiClient.post<SubmitAnswerResponse>('scheduler/answers', body),
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
    onError: (error, variables) => {
      // A 404 means the renderingId we answered against no longer exists -
      // useKnowledgeItemPrompt sets no staleTime, so a cached prompt can
      // outlive its rendering. Refetch rather than leaving the learner
      // stuck on a question that can never be submitted.
      if (error instanceof ApiError && error.status === 404) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.contentGraph.knowledgeItem(variables.knowledgeItemId),
        });
      }
    },
  });
}
