import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from '@ogwi/shared';
import { ApiError, apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Submits an answer for marking. Replaces useGradeReview, which decided
 * correctness in the browser and posted the verdict - the server now marks
 * the answer and only then tells us whether it was right.
 *
 * Carries an `attemptId` so a retried request is recognised as the same
 * learning act rather than written twice. Its lifetime is "from committing to
 * an answer until that answer is known to be recorded":
 *   - NOT per click - both call sites clear their selection in onError
 *     precisely so the learner can retry, and a fresh id there is exactly the
 *     double-write this exists to prevent.
 *   - NOT per item either - composition can legitimately hand back the same
 *     item again, and keying on it would silently swallow a genuine second
 *     answer, which is the cooldown Doc 2 B8 forbids.
 * So: mint on mount, rotate on success only.
 *
 * Every graded answer changes the recommended next session, the points
 * balance, due items and the flight, so those are refreshed. Displayed
 * mastery deliberately is NOT: it only changes at a publish point (Doc 2 C4 -
 * session end, practice-run end, exam submit, daily rollover), never
 * mid-activity. See usePublishMastery. Scoped invalidation via the query-key
 * factory, not a blanket refetch-everything.
 */
function newAttemptId(): string {
  // crypto.randomUUID needs a secure context; plain-http LAN testing doesn't
  // have one, and an un-keyed request would 400.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useSubmitAnswer(qualificationSlug: string) {
  const queryClient = useQueryClient();
  const attemptIdRef = useRef<string | null>(null);
  attemptIdRef.current ??= newAttemptId();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: queryKeys.composition.next(qualificationSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.economy.balance(qualificationSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.economy.recent(qualificationSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.due(qualificationSlug) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.adaptive.wrongAnswerPool(qualificationSlug),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.adaptive.remediationRecords(qualificationSlug),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.scheduler.reviewLog(qualificationSlug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.flight.state(qualificationSlug) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.readiness.qualification(qualificationSlug),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.flight.awards() });
  }

  return useMutation({
    mutationFn: (body: Omit<SubmitAnswerRequest, 'attemptId'>) =>
      apiClient.post<SubmitAnswerResponse>('scheduler/answers', {
        ...body,
        attemptId: attemptIdRef.current as string,
      }),
    onSuccess: () => {
      // The act is durable, so the next answer is a new one.
      attemptIdRef.current = newAttemptId();
      invalidateAll();
    },
    onError: (error, variables) => {
      // 409 means this attempt was already recorded with a different answer -
      // the first one landed. Treat it as recorded rather than as a failure,
      // or the learner sees a save error for an answer that saved fine.
      if (error instanceof ApiError && error.status === 409) {
        attemptIdRef.current = newAttemptId();
        invalidateAll();
        return;
      }

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
