import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExamResults } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Submitting is the publish point for a run (Doc 2 Part C4: "Session end /
 * Practice-run end"), which is why everything downstream is invalidated here
 * and nowhere earlier in the exam - nothing may republish mid-activity.
 */
export function useSubmitExamRun(runId: string, qualificationSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<ExamResults>(`exam/runs/${runId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exam.run(runId) });
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
