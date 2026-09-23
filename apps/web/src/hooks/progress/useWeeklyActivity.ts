import { useQuery } from '@tanstack/react-query';
import type { WeeklyActivity } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/** One Monday-to-Sunday week of activity. 0 is this week, 1 the week before it. */
export function useWeeklyActivity(qualificationSlug: string, weeksAgo: number) {
  return useQuery({
    queryKey: queryKeys.progress.weekly(qualificationSlug, weeksAgo),
    queryFn: () =>
      apiClient.get<WeeklyActivity>(
        `progress/weekly?qualificationSlug=${encodeURIComponent(qualificationSlug)}&weeksAgo=${weeksAgo}`,
      ),
    enabled: Boolean(qualificationSlug),
  });
}
