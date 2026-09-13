import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdvanceClockRequest, DevClock } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';

export function useAdvanceClock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seconds: number) =>
      apiClient.post<DevClock>('dev/clock/advance', { seconds } satisfies AdvanceClockRequest),
    // Deliberately everything: due items, flight decay, readiness windows and
    // remediation all move with the clock, so nothing cached is still true.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
