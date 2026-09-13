import { useQuery } from '@tanstack/react-query';
import type { RemediationRecord } from '@ogwi/shared';
import { apiClient } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/** Every item that has entered remediation, with its progress toward exit. */
export function useRemediationRecords(qualificationSlug: string) {
  return useQuery({
    queryKey: queryKeys.adaptive.remediationRecords(qualificationSlug),
    queryFn: () =>
      apiClient.get<RemediationRecord[]>(
        `adaptive/remediation-records?qualificationSlug=${encodeURIComponent(qualificationSlug)}`,
      ),
    enabled: Boolean(qualificationSlug),
  });
}
