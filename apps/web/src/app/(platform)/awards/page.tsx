'use client';

import { useAwards } from '@/hooks/flight/useAwards';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

/**
 * Doc 2 A14's altitude-firsts catalogue, trimmed to five bands (see
 * packages/shared/src/constants/awards.constants.ts for which, and why).
 * Awards are learner-global, not per-qualification - whichever course's
 * flight crosses a threshold first earns it, once, for the learner.
 */
export default function AwardsPage() {
  const { data, isLoading, error } = useAwards();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Awards</h1>

      {isLoading && <p>Loading...</p>}
      {error && <p>Could not reach the API.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        {data?.map((award) => (
          <Card key={award.slug} style={{ opacity: award.earnedAt ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{award.name}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}> — {award.thresholdFt}ft</span>
              </div>
              {award.earnedAt ? (
                <Badge tone="success">Earned {new Date(award.earnedAt).toLocaleDateString()}</Badge>
              ) : (
                <Badge>Locked</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      <p style={{ marginTop: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        Not built yet: flight-length streaks, big days, lifetime totals, sustained-altitude
        awards, comebacks, and course tie-ins — this is a five-band slice of the full catalogue,
        proving the award mechanism works end to end.
      </p>
    </div>
  );
}
