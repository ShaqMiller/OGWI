import { useQuery } from '@tanstack/react-query';
import type { ReviewLogEntry } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/** Recent answers with FSRS's prediction beside each outcome, newest first. */
export function useReviewLog(qualificationSlug: string, limit = 20) {
  return useQuery({
    queryKey: queryKeys.scheduler.reviewLog(qualificationSlug),
    queryFn: () =>
      apiClient.get<ReviewLogEntry[]>(
        `scheduler/review-log?qualificationSlug=${encodeURIComponent(qualificationSlug)}&limit=${limit}`,
      ),
    enabled: Boolean(qualificationSlug),
  });
}
