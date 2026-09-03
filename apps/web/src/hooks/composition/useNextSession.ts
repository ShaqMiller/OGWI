import { useQuery } from '@tanstack/react-query';
import type { NextSession } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

export function useNextSession(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.composition.next(qualificationSlug),
    queryFn: () =>
      apiClient.get<NextSession>(`composition/next?qualificationSlug=${qualificationSlug}`),
    enabled: Boolean(qualificationSlug),
  });
}
