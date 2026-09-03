import { useQuery } from '@tanstack/react-query';
import type { ExamResults } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useExamResults(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.exam.results(runId ?? ''),
    queryFn: () => apiClient.get<ExamResults>(`exam/runs/${runId}/results`),
    enabled: Boolean(runId),
  });
}
