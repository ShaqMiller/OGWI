import { useQueries } from '@tanstack/react-query';
import type { FlightStateResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Every listed qualification's flight at once, for views that aren't scoped
 * to one course (the nav, Awards). Shares useFlightState's query keys, so an
 * answer's invalidation refreshes these too.
 */
export function useFlightStates(qualificationSlugs: string[]) {
  return useQueries({
    queries: qualificationSlugs.map((slug) => ({
      queryKey: queryKeys.flight.state(slug),
      queryFn: () => apiClient.get<FlightStateResponse>(`flight/state?qualificationSlug=${slug}`),
      staleTime: 0,
    })),
  });
}
