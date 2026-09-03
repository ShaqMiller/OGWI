import { useMutation } from '@tanstack/react-query';
import type { ScoreTextRequest, ScoreTextResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Nothing to invalidate on success - scoring is a pure, unpersisted
 * computation (see apps/api/src/modules/recall/recall.service.ts).
 */
export function useScoreText(topicId: string) {
  return useMutation({
    mutationFn: (body: ScoreTextRequest) =>
      apiClient.post<ScoreTextResponse>(`recall/topics/${topicId}/score`, body),
  });
}
