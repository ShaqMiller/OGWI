'use client';

import type { RemediationRecord } from '@ogwi/shared';
import { useRemediationRecords } from '@/hooks/adaptive/useRemediationRecords';
import { Card } from '@/components/ui/Card';
import { formatUtc, formatUtcDay } from './format';
import { ItemLabel } from './ItemLabel';

const muted = { color: 'var(--color-text-muted)', fontSize: '0.85rem' };

function Progress({ record }: { record: RemediationRecord }) {
  const counted = record.qualifyingAnswers.length;

  return (
    <>
      <div>
        Correct <strong>{counted}</strong> of {record.correctAnswersRequired}
        {record.qualifyingAnswers.length > 0 && (
          <span style={muted}>
            {' '}
            · counted on{' '}
            {record.qualifyingAnswers
              .map((answer) =>
                record.renderingDistinctnessEnforced && answer.renderingId
                  ? `${formatUtcDay(answer.reviewedAt)} (rendering ${answer.renderingId.slice(0, 6)})`
                  : formatUtcDay(answer.reviewedAt),
              )
              .join(', ')}
          </span>
        )}
      </div>

      {record.status === 'in_remediation' && record.nextQualifyingFrom && (
        <div style={muted}>
          {counted === 0
            ? 'A correct answer counts straight away.'
            : `The next correct answer only counts from ${formatUtc(record.nextQualifyingFrom)} UTC - a different day.`}
          {record.renderingDistinctnessEnforced && ' It must also be on a different rendering.'}
        </div>
      )}
    </>
  );
}

/**
 * The remediation record for each item a learner has missed (Doc 2 B3): where
 * the miss came from, and exactly how far the item is through the exit rule.
 */
export function RemediationRecordsCard({ slug }: { slug: string }) {
  const records = useRemediationRecords(slug);

  return (
    <Card style={{ marginBottom: 'var(--space-4)' }}>
      <h2 style={{ marginTop: 0 }}>Remediation records</h2>
      <p style={muted}>
        Any wrong answer puts an item into remediation. It comes out after correct answers on two
        different days (UTC). The format ladder isn&apos;t built yet, so there is no rung to show.
      </p>

      {records.isLoading && <p>Loading...</p>}
      {records.isError && <p style={{ color: 'var(--color-danger)' }}>{records.error.message}</p>}
      {records.data?.length === 0 && <p>Nothing has been missed yet.</p>}

      {records.data?.map((record) => (
        <div
          key={record.knowledgeItemId}
          style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <strong>
              <ItemLabel knowledgeItemId={record.knowledgeItemId} />
            </strong>
            <span style={{ whiteSpace: 'nowrap' }}>
              {record.status === 'in_remediation' ? 'In remediation' : 'Exited'}
            </span>
          </div>
          <div style={muted}>
            Missed in {record.source} · {formatUtc(record.enteredAt)} UTC
            {record.againCount > 1 && ` · missed ${record.againCount} times this episode`}
            {record.exitedAt && ` · exited ${formatUtc(record.exitedAt)} UTC`}
            {' · '}
            {record.moduleName}
          </div>
          <Progress record={record} />
        </div>
      ))}
    </Card>
  );
}
