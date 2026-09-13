import { useQuery } from '@tanstack/react-query';
import type { DevClock } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/** Only meaningful for a demo learner - the API refuses anyone else - so the caller gates it. */
export function useDevClock(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dev.clock(),
    queryFn: () => apiClient.get<DevClock>('dev/clock'),
    enabled,
  });
}
