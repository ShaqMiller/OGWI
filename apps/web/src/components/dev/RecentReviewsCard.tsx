'use client';

import { useReviewLog } from '@/hooks/scheduler/useReviewLog';
import { Card } from '@/components/ui/Card';
import { formatPercent, formatUtc } from './format';
import { ItemLabel } from './ItemLabel';

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };
const cell = { padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' as const };

/** The prediction-vs-outcome log: what FSRS expected, beside what happened. */
export function RecentReviewsCard({ slug }: { slug: string }) {
  const log = useReviewLog(slug);

  return (
    <Card style={{ marginBottom: 'var(--space-4)' }}>
      <h2 style={{ marginTop: 0 }}>Predicted vs actual</h2>
      <p style={muted}>
        FSRS&apos;s predicted chance of recall at the moment of answering, next to the outcome. No
        prediction means the question had never been seen.
      </p>

      {log.isLoading && <p>Loading...</p>}
      {log.isError && <p style={{ color: 'var(--color-danger)' }}>{log.error.message}</p>}
      {log.data?.length === 0 && <p>No answers yet.</p>}

      {log.data && log.data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['When (UTC)', 'Question', 'From', 'Predicted', 'Actual', 'Next due'].map((heading) => (
                  <th key={heading} style={{ ...cell, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.data.map((entry) => (
                <tr key={`${entry.knowledgeItemId}-${String(entry.reviewedAt)}`}>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatUtc(entry.reviewedAt)}</td>
                  <td style={cell}>
                    <ItemLabel knowledgeItemId={entry.knowledgeItemId} />
                  </td>
                  <td style={cell}>{entry.source}</td>
                  <td style={cell}>
                    {entry.predictedRetrievability === null ? '-' : formatPercent(entry.predictedRetrievability)}
                  </td>
                  <td style={cell}>{entry.outcome}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatUtc(entry.resultingDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
