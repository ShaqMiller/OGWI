'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEMO_LEARNER_ID } from '@ogwi/shared';
import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { useAdvanceClock } from '@/hooks/dev/useAdvanceClock';
import { useDevClock } from '@/hooks/dev/useDevClock';
import { useResetDemoLearner } from '@/hooks/dev/useResetDemoLearner';
import { readDevLearnerCookie, writeDevLearnerCookie } from '@/lib/devLearner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatUtc } from './format';
import { RecentReviewsCard } from './RecentReviewsCard';

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };
const cardGap = { marginBottom: 'var(--space-4)' };

function formatOffset(seconds: number): string {
  if (seconds === 0) return 'running on real time';

  const days = Math.floor(seconds / DAY_S);
  const hours = Math.floor((seconds % DAY_S) / HOUR_S);
  const parts = [days > 0 ? `${days}d` : null, hours > 0 ? `${hours}h` : null].filter(Boolean);
  return `${parts.join(' ') || '<1h'} ahead of real time`;
}

/**
 * The test clock, and a window onto what it moves. Plain on purpose - this is
 * for demonstrating the engines, not for learners.
 */
export function DevPanel({ defaultLearnerId }: { defaultLearnerId: string }) {
  const queryClient = useQueryClient();
  // Read after mount: the cookie isn't visible while rendering on the server.
  const [demoActive, setDemoActive] = useState<boolean | null>(null);
  useEffect(() => setDemoActive(readDevLearnerCookie() === DEMO_LEARNER_ID), []);

  const qualifications = useQualifications();
  const [chosenSlug, setChosenSlug] = useState<string | null>(null);
  const slug = chosenSlug ?? qualifications.data?.[0]?.slug ?? '';

  const clock = useDevClock(demoActive === true);
  const advance = useAdvanceClock();
  const reset = useResetDemoLearner();

  function switchLearner(toDemo: boolean) {
    writeDevLearnerCookie(toDemo ? DEMO_LEARNER_ID : null);
    setDemoActive(toDemo);
    // Query keys don't carry the learner, so everything cached belongs to the
    // previous one.
    void queryClient.resetQueries();
  }

  function resetDemoLearner() {
    if (window.confirm(`Delete everything ${DEMO_LEARNER_ID} has done and return it to real time?`)) {
      reset.mutate();
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Dev tools</h1>
      <p style={muted}>
        Only exists while TEST_CLOCK_ENABLED is on. The clock moves time for demo learners only -{' '}
        {defaultLearnerId} always runs on real time.
      </p>

      <Card style={cardGap}>
        <h2 style={{ marginTop: 0 }}>Learner</h2>
        {demoActive === null ? (
          <p>Loading...</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span>
              The whole app is acting as <strong>{demoActive ? DEMO_LEARNER_ID : defaultLearnerId}</strong>
            </span>
            <Button variant="secondary" onClick={() => switchLearner(!demoActive)}>
              {demoActive ? `Switch back to ${defaultLearnerId}` : `Switch to ${DEMO_LEARNER_ID}`}
            </Button>
          </div>
        )}

        <label style={{ display: 'block', marginTop: 'var(--space-3)' }}>
          <span style={muted}>Qualification </span>
          <select value={slug} onChange={(event) => setChosenSlug(event.target.value)}>
            {qualifications.data?.map((qualification) => (
              <option key={qualification.slug} value={qualification.slug}>
                {qualification.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {demoActive && (
        <Card style={cardGap}>
          <h2 style={{ marginTop: 0 }}>Clock</h2>
          {clock.data && (
            <p>
              <strong>{formatUtc(clock.data.now)} UTC</strong>{' '}
              <span style={muted}>· {formatOffset(clock.data.offsetSeconds)}</span>
            </p>
          )}
          {clock.isError && <p style={{ color: 'var(--color-danger)' }}>{clock.error.message}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button disabled={advance.isPending} onClick={() => advance.mutate(HOUR_S)}>
              +1 hour
            </Button>
            <Button disabled={advance.isPending} onClick={() => advance.mutate(DAY_S)}>
              +1 day
            </Button>
            <Button variant="secondary" disabled={reset.isPending} onClick={resetDemoLearner}>
              Reset demo learner
            </Button>
          </div>
          <p style={muted}>
            Time only moves forward. Reset deletes the demo learner&apos;s history, which is the only
            way back to real time.
          </p>
          {advance.isError && <p style={{ color: 'var(--color-danger)' }}>{advance.error.message}</p>}
          {reset.isError && <p style={{ color: 'var(--color-danger)' }}>{reset.error.message}</p>}
        </Card>
      )}

      {demoActive !== null && slug !== '' && <RecentReviewsCard slug={slug} />}

      {slug === '' && qualifications.isSuccess && <p>No qualifications are seeded.</p>}
    </div>
  );
}
