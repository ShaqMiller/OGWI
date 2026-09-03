import { useQuery } from '@tanstack/react-query';
import type { ExamPaper } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The paper, fetched once and then left alone. staleTime Infinity matters:
 * Back/Next must never trigger a refetch that could stomp selections the
 * learner has made but not yet saved.
 */
export function useExamRun(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.exam.run(runId ?? ''),
    queryFn: () => apiClient.get<ExamPaper>(`exam/runs/${runId}`),
    enabled: Boolean(runId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
