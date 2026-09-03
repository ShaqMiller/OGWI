import { useQuery } from '@tanstack/react-query';
import type { TopicKeyPointsResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Also used to decide whether to show the Blurt / Teach Oggi buttons at
 * all - a topic with no seeded key points means "not available yet".
 */
export function useTopicKeyPoints(topicId: string | null) {
  return useQuery({
    queryKey: queryKeys.recall.keyPoints(topicId ?? ''),
    queryFn: () => apiClient.get<TopicKeyPointsResponse>(`recall/topics/${topicId}/key-points`),
    enabled: Boolean(topicId),
  });
}
