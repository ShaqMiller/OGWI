'use client';

import Link from 'next/link';
import type { Qualification } from '@ogwi/shared';
import { useMastery } from '@/hooks/mastery/useMastery';
import { useEconomyBalance } from '@/hooks/economy/useEconomyBalance';
import { useFlightState } from '@/hooks/flight/useFlightState';
import { useReadiness } from '@/hooks/readiness/useReadiness';
import { ModuleMasteryBar } from '@/components/mastery/ModuleMasteryBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const CERTAINTY_TONE = { early: 'neutral', fair: 'neutral', solid: 'success' } as const;

/**
 * The band is about how much evidence the odds rest on, so the label says
 * that rather than printing the raw enum. "early" next to a high coverage
 * figure otherwise reads as a demotion, when what it actually means is
 * "nothing has tested this under exam conditions yet".
 */
const CERTAINTY_LABEL = {
  early: 'Early read',
  fair: 'Fairly confident',
  solid: 'Solid',
} as const;

/** Names the fix, without the handover's banned "behind"/"overdue" framing. */
const CERTAINTY_NEXT_STEP = {
  early: 'Sit an exam simulation to firm this up.',
  fair: 'One more exam simulation would make this solid.',
  solid: null,
} as const;

/**
 * "2026-09-23" -> "23 Sep". Read as UTC so the day can't shift across a
 * timezone boundary.
 */
function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * One qualification's progress summary. A separate component (rather than
 * inline in the Progress page's list) so each card can call its own hooks
 * for its own slug - hooks can't be called in a loop at the page level.
 */
export function QualificationProgressCard({ qualification }: { qualification: Qualification }) {
  const mastery = useMastery(qualification.slug);
  const balance = useEconomyBalance(qualification.slug);
  const flight = useFlightState(qualification.slug);
  const readiness = useReadiness(qualification.slug);

  return (
    <Card style={{ margin: 'var(--space-4) 0' }}>
      <h2 style={{ margin: 0 }}>
        <Link href={`/qualifications/${qualification.slug}`} style={{ textDecoration: 'none' }}>
          {qualification.name}
        </Link>
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          margin: 'var(--space-2) 0 var(--space-3)',
          color: 'var(--color-text-muted)',
          fontSize: '0.9rem',
        }}
      >
        <span>{balance.data?.totalPoints ?? '—'} points</span>
        {flight.data && (
          <span>
            {flight.data.isAirborne
              ? `${Math.round(flight.data.fill)}ft altitude`
              : `Grounded (${Math.round(flight.data.fill)}L / 100 to liftoff)`}
          </span>
        )}
      </div>

      {mastery.isLoading && <p>Loading mastery...</p>}
      {mastery.data?.length === 0 && <p>No modules yet.</p>}
      {mastery.data?.map((m) => <ModuleMasteryBar key={m.moduleId} mastery={m} />)}

      {/*
        A forecast of working through the material, NOT of being ready to pass.
        It lives with the coverage bars rather than under the odds of passing,
        because under the odds it read as a "ready by" date - which the
        client's decision log rejects. Readiness itself has no date.
      */}
      {readiness.data?.forecast.expectedFinishDate &&
        readiness.data.forecast.itemsRemaining > 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 'var(--space-2) 0 0' }}>
            At this pace you&apos;ll have worked through the whole course by around{' '}
            {formatShortDate(readiness.data.forecast.expectedFinishDate)}.
          </p>
        )}

      {readiness.data && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: '0.9rem' }}>
          {readiness.data.withheld ? (
            <>
              Odds of passing: <Badge>under 20%</Badge> — on track at{' '}
              {readiness.data.weightedCoveragePercent}% coverage; climbs as you go
            </>
          ) : (
            <>
              Odds of passing if you sat it soon: <strong>{readiness.data.oddsPercent}%</strong>{' '}
              <Badge tone={CERTAINTY_TONE[readiness.data.certaintyBand]}>
                {CERTAINTY_LABEL[readiness.data.certaintyBand]}
              </Badge>
              {CERTAINTY_NEXT_STEP[readiness.data.certaintyBand] && (
                <div style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  {CERTAINTY_NEXT_STEP[readiness.data.certaintyBand]}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
