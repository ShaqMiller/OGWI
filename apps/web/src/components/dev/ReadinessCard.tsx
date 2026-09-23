'use client';

import type { PublishedReadiness } from '@ogwi/shared';
import { useReadiness } from '@/hooks/readiness/useReadiness';
import { Card } from '@/components/ui/Card';
import { ReadinessUnlockChecklist } from '@/components/progress/ReadinessUnlockChecklist';
import { formatPercent, formatUtc } from './format';

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };
const cell = { padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' as const };
const numeric = { ...cell, fontVariantNumeric: 'tabular-nums' as const };

function Row({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <tr>
      <td style={cell}>{label}</td>
      <td style={numeric}>
        <strong>{value}</strong>
      </td>
      <td style={{ ...cell, ...muted }}>{note}</td>
    </tr>
  );
}

function shownOdds(published: PublishedReadiness): string {
  if (!published.unlocked) return 'none yet - checklist incomplete';
  if (published.withheld) return 'withheld (under 20%)';
  return `${published.oddsPercent}%`;
}

/**
 * The odds of passing, walked through piece by piece (Doc 2 B2) - the order the
 * number is actually built in, from the last publish point.
 */
export function ReadinessCard({ slug }: { slug: string }) {
  const readiness = useReadiness(slug);
  const published = readiness.data?.published ?? null;
  const breakdown = published?.breakdown;

  return (
    <Card style={{ marginBottom: 'var(--space-4)' }}>
      <h2 style={{ marginTop: 0 }}>Odds of passing, piece by piece</h2>
      <p style={muted}>
        Recomputed only at publish points, from live memory state only - never the published mastery
        above. {published ? `Last published ${formatUtc(published.publishedAt)} UTC.` : 'Not published yet.'}
      </p>

      {readiness.isLoading && <p>Loading...</p>}
      {readiness.isError && <p style={{ color: 'var(--color-danger)' }}>{readiness.error.message}</p>}

      {readiness.data && (
        <ReadinessUnlockChecklist
          checklist={readiness.data.checklist}
          scorePublished={published?.unlocked ?? false}
        />
      )}

      {published && breakdown && (
        <div style={{ overflowX: 'auto', marginTop: 'var(--space-3)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <tbody>
              <Row
                label="1. Projected score"
                value={formatPercent(breakdown.projectedScore)}
                note="every question's recall projected 14 days out, weighted like the exam"
              />
              <Row
                label="2. Calibration ratio"
                value={`× ${breakdown.calibrationRatio.toFixed(2)}`}
                note={
                  breakdown.meanRatio === null
                    ? 'no exam run to calibrate against yet - 1.0'
                    : `recency-weighted mean ${breakdown.meanRatio.toFixed(2)}, clamped to 0.70-1.10`
                }
              />
              <Row label="3. Calibrated score" value={formatPercent(breakdown.calibratedScore)} />
              <Row label="4. Pass mark" value={formatPercent(breakdown.passMark)} />
              <Row
                label="5. Uncertainty (sigma)"
                value={breakdown.sigma.toFixed(3)}
                note={
                  breakdown.sigmaComponents
                    ? `coverage ${breakdown.sigmaComponents.coverage.toFixed(3)} · exam evidence ${breakdown.sigmaComponents.evidence.toFixed(3)} · run spread ${breakdown.sigmaComponents.spread.toFixed(3)} · paper noise ${breakdown.sigmaComponents.residual.toFixed(3)} (combined as independent sources, floor 0.05)`
                    : `wider when coverage is thin - ${published.weightedCoveragePercent}% covered`
                }
              />
              <Row
                label="6. P(pass)"
                value={formatPercent(breakdown.oddsRaw)}
                note="Phi((calibrated - pass mark) / sigma)"
              />
              <Row label="Shown to the learner" value={shownOdds(published)} />
              <Row label="Certainty" value={published.certaintyBand} note="needs coverage and recent exam runs" />
              <Row
                label="Next action"
                value={published.nextAction ? published.nextAction.kind.replace(/_/g, ' ') : 'none'}
                note={published.nextAction?.line ?? 'nothing would improve the odds or the certainty'}
              />
              <Row
                label="Forecast"
                value={published.forecast.frozen ? 'frozen' : 'live'}
                note={published.forecast.frozen ? '14+ quiet days - held at its last value' : undefined}
              />
              <Row
                label="Spacing horizon"
                value={`${published.horizonDays} days`}
                note="how far ahead the scheduler may place a review - not a deadline, never shown to a learner"
              />
              <Row label="First-score reveal" value={published.firstScore ? 'yes, this publication' : 'no'} />
              <Row label="Celebration" value={published.celebrate ? 'fired on this publication' : 'no'} note="once ever, on a rising crossing of 80% with fair+ certainty" />
            </tbody>
          </table>
        </div>
      )}

      {breakdown?.nextActionCandidates && breakdown.nextActionCandidates.length > 0 && (
        <>
          <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', fontSize: '0.95rem' }}>
            Next-action candidates, simulated
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Candidate', 'Odds change', 'Band steps', 'Score'].map((heading) => (
                    <th key={heading} style={{ ...cell, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.nextActionCandidates.map((candidate) => (
                  <tr key={candidate.kind}>
                    <td style={cell}>{candidate.line}</td>
                    <td style={numeric}>
                      {candidate.oddsDelta >= 0 ? '+' : ''}
                      {(candidate.oddsDelta * 100).toFixed(1)} pts
                    </td>
                    <td style={numeric}>{candidate.bandSteps}</td>
                    <td style={numeric}>{candidate.score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={muted}>Highest score wins; ties prefer the mini-mock, then the refresh. A band step counts as 10 points.</p>
        </>
      )}

      {breakdown && breakdown.calibrationRuns.length > 0 && (
        <>
          <h3 style={{ margin: 'var(--space-4) 0 var(--space-2)', fontSize: '0.95rem' }}>Exam runs behind the ratio</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Submitted (UTC)', 'Achieved', 'Projected then', 'Ratio', 'Weight'].map((heading) => (
                    <th key={heading} style={{ ...cell, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.calibrationRuns.map((run) => (
                  <tr key={String(run.submittedAt)}>
                    <td style={cell}>{formatUtc(run.submittedAt)}</td>
                    <td style={numeric}>{formatPercent(run.achievedScore)}</td>
                    <td style={numeric}>{formatPercent(run.projectedScore)}</td>
                    <td style={numeric}>{run.ratio === null ? 'too low to use' : run.ratio.toFixed(2)}</td>
                    <td style={numeric}>{run.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
