import { useQuery } from '@tanstack/react-query';
import type { FlightStateResponse } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useFlightState(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.flight.state(qualificationSlug),
    queryFn: () =>
      apiClient.get<FlightStateResponse>(`flight/state?qualificationSlug=${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
    // Altitude decays continuously - a moment-old cached value is a stale
    // number by construction (Doc 2 B9), so keep this fresh on refocus.
    staleTime: 0,
  });
}
