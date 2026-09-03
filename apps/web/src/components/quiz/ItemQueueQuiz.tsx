'use client';

import { useState } from 'react';
import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';
import { useGradeReview } from '@/hooks/scheduler/useGradeReview';
import { MultipleChoiceOptions } from './MultipleChoiceOptions';

/**
 * Practice's quiz-taking flow: a fixed, learner-chosen batch of items
 * (unlike the qualification dashboard's composition-driven "always show
 * the live next item"). Walks through `itemIds` via a local index rather
 * than re-deriving "what's next" from the server after every answer.
 */
export function ItemQueueQuiz({
  qualificationSlug,
  itemIds,
}: {
  qualificationSlug: string;
  itemIds: string[];
}) {
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const gradeReview = useGradeReview(qualificationSlug);

  const currentItemId = itemIds[index] ?? null;
  const prompt = useKnowledgeItemPrompt(currentItemId);

  function selectOption(optionIndex: number) {
    if (selectedOption !== null || !prompt.data || !currentItemId) return;

    setSelectedOption(optionIndex);
    const isCorrect = optionIndex === prompt.data.correctOptionIndex;

    gradeReview.mutate(
      { knowledgeItemId: currentItemId, grade: isCorrect ? 'good' : 'again' },
      {
        onSuccess: () =>
          setTimeout(() => {
            setSelectedOption(null);
            setIndex((i) => i + 1);
          }, 900),
      },
    );
  }

  if (index >= itemIds.length) {
    return <p>You&apos;ve practiced everything in this batch.</p>;
  }

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        {index + 1} of {itemIds.length}
      </p>
      {prompt.data && (
        <>
          <p>{prompt.data.prompt}</p>
          <MultipleChoiceOptions
            options={prompt.data.options}
            correctOptionIndex={prompt.data.correctOptionIndex}
            selectedOption={selectedOption}
            onSelect={selectOption}
          />
        </>
      )}
      {!prompt.data && <p>Loading question...</p>}
    </div>
  );
}
