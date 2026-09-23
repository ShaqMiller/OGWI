'use client';

import { MASTERY_ROLLOVER_IDLE_MINUTES, type ModuleMastery } from '@ogwi/shared';
import { useMastery } from '@/hooks/mastery/useMastery';
import { usePublishSession } from '@/hooks/publishing/usePublishSession';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatPercent } from './format';

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };
const cell = { padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' as const };

function gap(module: ModuleMastery): string {
  const difference = module.displayedScore - module.liveScore;
  if (Math.abs(difference) < 0.005) return '';
  return difference < 0 ? 'gain waiting for a publish point' : 'easing down toward live';
}

/** Live vs displayed mastery, side by side, so a publish point is visible when it happens. */
export function MasteryCard({ slug }: { slug: string }) {
  const mastery = useMastery(slug);
  const publish = usePublishSession(slug);

  return (
    <Card style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <h2 style={{ margin: 0 }}>Mastery: live vs displayed</h2>
        <Button variant="secondary" disabled={publish.isPending} onClick={() => publish.mutate()}>
          End session (publish)
        </Button>
      </div>
      <p style={muted}>
        Live moves with every answer. Displayed - what learners see - only changes at a publish
        point: ending a session, finishing a topic or practice batch, submitting an exam, or the first
        visit of a new UTC day once the learner has been idle {MASTERY_ROLLOVER_IDLE_MINUTES} minutes.
      </p>

      {mastery.isLoading && <p>Loading...</p>}
      {mastery.isError && <p style={{ color: 'var(--color-danger)' }}>{mastery.error.message}</p>}
      {publish.isError && <p style={{ color: 'var(--color-danger)' }}>{publish.error.message}</p>}

      {mastery.data && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['Module', 'Live', 'Displayed', ''].map((heading) => (
                  <th key={heading} style={{ ...cell, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mastery.data.modules.map((module) => (
                <tr key={module.moduleId}>
                  <td style={cell}>{module.moduleName}</td>
                  <td style={cell}>{formatPercent(module.liveScore)}</td>
                  <td style={cell}>
                    <strong>{formatPercent(module.displayedScore)}</strong>
                  </td>
                  <td style={{ ...cell, ...muted }}>{gap(module)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
