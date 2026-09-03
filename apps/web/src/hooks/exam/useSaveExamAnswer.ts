import { useMutation } from '@tanstack/react-query';
import type { SaveExamAnswerRequest, SaveExamAnswerResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Auto-saves one selection. Invalidates nothing on purpose - invalidating the
 * paper would refetch it mid-exam and discard local state. The response is an
 * acknowledgement only; it cannot tell the learner whether they were right.
 */
export function useSaveExamAnswer(runId: string) {
  return useMutation({
    mutationFn: (body: SaveExamAnswerRequest) =>
      apiClient.post<SaveExamAnswerResponse>(`exam/runs/${runId}/answers`, body),
  });
}
