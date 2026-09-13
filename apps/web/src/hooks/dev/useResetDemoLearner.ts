import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResetDemoLearnerResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';

export function useResetDemoLearner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<ResetDemoLearnerResponse>('dev/demo-learner/reset'),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
