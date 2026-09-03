import { useMutation } from '@tanstack/react-query';
import type { StartExamRunRequest, StartExamRunResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Starts a fresh randomised paper. Doc 2 A5: "one entry generating a fresh
 * randomised paper each time" - so this deliberately never reuses an
 * in-progress run.
 */
export function useStartExamRun() {
  return useMutation({
    mutationFn: (body: StartExamRunRequest) =>
      apiClient.post<StartExamRunResponse>('exam/runs', body),
  });
}
