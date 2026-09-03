'use client';

import { useRouter } from 'next/navigation';
import { useExamResults } from '@/hooks/exam/useExamResults';
import { MultipleChoiceOptions } from '@/components/quiz/MultipleChoiceOptions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * The results screen (Doc 2 A5A): score, pass/fail against the qualification's
 * pass mark, time used versus allotted, and Review Answers per question.
 *
 * This is the first surface in an exam run allowed to show the correct
 * answer - the run is over, so revealing it is teaching rather than aiding.
 * MultipleChoiceOptions IS reused here for exactly that reason.
 *
 * Deliberately shows no attempt number, attempt count, history or comparison
 * against a previous sitting - invariant 12 and A13. Mock scores are also
 * private (A5), so nothing here is shareable or ranked.
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return 'under a minute';
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function ExamResults({ runId }: { runId: string }) {
  const router = useRouter();
  const results = useExamResults(runId);

  if (results.isLoading) return <p>Marking your paper...</p>;
  if (results.isError || !results.data) return <p>Those results could not be opened.</p>;

  const data = results.data;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{data.qualificationName}</h1>

      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ fontSize: '1.6rem', margin: 0 }}>
          <strong>
            {data.correctCount} of {data.scoredCount}
          </strong>{' '}
          <span style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
            ({data.scorePercent}%)
          </span>
        </p>
        <p style={{ color: data.passed ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
          {data.passed
            ? `Above the ${data.passMarkPercent}% pass mark.`
            : `Not yet at the ${data.passMarkPercent}% pass mark.`}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          {/* Doc 2 B8: exam litres accrue silently and pay here, at the
              feedback screen - this is the first time they are shown. */}
          Earned <strong style={{ color: 'var(--color-text)' }}>{data.litresEarned}</strong> points
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Took {formatDuration(data.secondsUsed)} of about{' '}
          {formatDuration(data.allottedSeconds)} allowed
          {data.answeredCount < data.scoredCount && (
            <> · {data.scoredCount - data.answeredCount} left blank</>
          )}
        </p>
      </Card>

      <h2>Review your answers</h2>
      {data.questions.map((question) => (
        <Card key={question.knowledgeItemId} style={{ marginBottom: 'var(--space-3)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 0 }}>
            {question.moduleName} · {question.topicName}
          </p>
          <p>{question.prompt}</p>

          <MultipleChoiceOptions
            options={question.options}
            correctOptionIndex={question.correctOptionIndex}
            selectedOption={question.selectedOptionIndex}
            onSelect={() => undefined}
            readOnly
          />

          {question.selectedOptionIndex === null && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              You didn&apos;t answer this one.
            </p>
          )}
          {question.explanation && (
            <p style={{ fontSize: '0.9rem' }}>{question.explanation}</p>
          )}
        </Card>
      ))}

      <Button onClick={() => router.push('/practice')}>Back to Practice</Button>
    </div>
  );
}
