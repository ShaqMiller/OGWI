'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExamRun } from '@/hooks/exam/useExamRun';
import { useSaveExamAnswer } from '@/hooks/exam/useSaveExamAnswer';
import { useSubmitExamRun } from '@/hooks/exam/useSubmitExamRun';
import { Button } from '@/components/ui/Button';
import { ExamOptions } from './ExamOptions';

/**
 * Sitting an exam run. Deliberately contains no feedback machinery of any
 * kind (invariant 10): no marking, no colours, no score, no hints, no Oggi.
 * Nothing here can tell the learner how they are doing, because nothing here
 * knows.
 *
 * Answers stay changeable until submit - Doc 2 A5 specifies Back/Next and
 * "select + Submit-to-confirm". Selections are saved as they're made, so a
 * reload restores the paper; the confirm step before submitting lists how
 * many are unanswered, per A2's "one honest confirm".
 *
 * Not built here (see docs/BUILD_ORDER.md): the pausable timer, per-question
 * flagging, and the question-navigation panel.
 */
function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} minutes`;
}

export function ExamRunner({ runId }: { runId: string }) {
  const router = useRouter();
  const paper = useExamRun(runId);
  const saveAnswer = useSaveExamAnswer(runId);
  const submitRun = useSubmitExamRun(runId, paper.data?.qualificationSlug ?? '');

  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  // Local selections layer over whatever the server had saved, so the UI
  // stays responsive and Back/Next never waits on a round trip.
  const [selections, setSelections] = useState<Record<string, number>>({});

  const questions = useMemo(() => paper.data?.questions ?? [], [paper.data]);
  const current = questions[index];

  const selectionFor = (knowledgeItemId: string, saved: number | null): number | null =>
    selections[knowledgeItemId] ?? saved;

  const answeredCount = questions.filter(
    (question) => selectionFor(question.knowledgeItemId, question.selectedOptionIndex) !== null,
  ).length;

  function select(optionIndex: number) {
    if (!current) return;

    setSelections((previous) => ({ ...previous, [current.knowledgeItemId]: optionIndex }));
    saveAnswer.mutate({
      knowledgeItemId: current.knowledgeItemId,
      selectedOptionIndex: optionIndex,
    });
  }

  function submit() {
    submitRun.mutate(undefined, {
      onSuccess: () => router.push(`/exam/${runId}/results`),
    });
  }

  if (paper.isLoading) return <p>Loading your paper...</p>;
  if (paper.isError || !paper.data) return <p>That exam run could not be opened.</p>;

  if (paper.data.status === 'SUBMITTED') {
    return (
      <div>
        <p>This exam has already been submitted.</p>
        <Button onClick={() => router.push(`/exam/${runId}/results`)}>See your results</Button>
      </div>
    );
  }

  if (confirming) {
    const unanswered = paper.data.questionCount - answeredCount;

    return (
      <div>
        <h1 style={{ marginTop: 0 }}>Submit this exam?</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          {unanswered > 0
            ? `You've answered ${answeredCount} of ${paper.data.questionCount}. ${unanswered} ${
                unanswered === 1 ? 'question is' : 'questions are'
              } still blank, and blank answers don't score.`
            : `You've answered all ${paper.data.questionCount} questions.`}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          <Button onClick={submit} disabled={submitRun.isPending}>
            {submitRun.isPending ? 'Grading...' : 'Grade my answers'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Keep testing
          </Button>
        </div>
        {submitRun.isError && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            That didn&apos;t go through. Try again - your answers are saved.
          </p>
        )}
      </div>
    );
  }

  if (!current) return <p>This paper has no questions.</p>;

  const selected = selectionFor(current.knowledgeItemId, current.selectedOptionIndex);
  const isLast = index === questions.length - 1;

  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span>
          Question {index + 1} of {paper.data.questionCount}
        </span>
        {/* Static, not a countdown: Doc 4 argues against countdown pressure, and
            the pausable timer the spec wants isn't built yet. */}
        <span>About {formatMinutes(paper.data.allottedSeconds)} suggested</span>
      </header>

      <p style={{ fontSize: '1.05rem' }}>{current.prompt}</p>

      <ExamOptions options={current.options} selectedOption={selected} onSelect={select} />

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-4)',
        }}
      >
        <Button variant="secondary" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          Back
        </Button>
        {isLast ? (
          <Button onClick={() => setConfirming(true)}>Finish</Button>
        ) : (
          <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
        )}
      </footer>

      {saveAnswer.isError && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          That answer hasn&apos;t saved yet. Keep going - you can revisit it before submitting.
        </p>
      )}
    </div>
  );
}
