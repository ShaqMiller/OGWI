'use client';

import { useState } from 'react';
import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';
import { useSubmitAnswer } from '@/hooks/scheduler/useSubmitAnswer';
import { MultipleChoiceOptions } from './MultipleChoiceOptions';

/**
 * Practice's quiz-taking flow: a fixed, learner-chosen batch of items
 * (unlike the qualification dashboard's composition-driven "always show
 * the live next item"). Walks through `itemIds` via a local index rather
 * than re-deriving "what's next" from the server after every answer.
 *
 * Answers are marked server-side (POST /api/scheduler/answers); the correct
 * option is only known once that responds.
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
  // Tagged with the item it belongs to: advancing is delayed by 900ms, so
  // without the tag a late result could be painted onto the next question.
  const [marked, setMarked] = useState<{ itemId: string; correctOptionIndex: number } | null>(null);
  const submitAnswer = useSubmitAnswer(qualificationSlug);

  const currentItemId = itemIds[index] ?? null;
  const prompt = useKnowledgeItemPrompt(currentItemId);

  function selectOption(optionIndex: number) {
    if (selectedOption !== null || !prompt.data || !currentItemId) return;

    const answeredItemId = currentItemId;
    setSelectedOption(optionIndex);

    submitAnswer.mutate(
      {
        knowledgeItemId: answeredItemId,
        renderingId: prompt.data.renderingId,
        answer: { kind: 'option_index', selectedOptionIndex: optionIndex },
      },
      {
        onSuccess: (result) => {
          setMarked({ itemId: answeredItemId, correctOptionIndex: result.correctOptionIndex });
          setTimeout(() => {
            setSelectedOption(null);
            setMarked(null);
            setIndex((i) => i + 1);
          }, 900);
        },
        // Unlock so the learner can retry. Without this a failed submission
        // strands them on a locked question and the queue never advances.
        onError: () => setSelectedOption(null),
      },
    );
  }

  if (index >= itemIds.length) {
    return <p>You&apos;ve practiced everything in this batch.</p>;
  }

  const markedForCurrentItem = marked?.itemId === currentItemId ? marked.correctOptionIndex : null;

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
            correctOptionIndex={markedForCurrentItem}
            selectedOption={selectedOption}
            onSelect={selectOption}
          />
        </>
      )}
      {!prompt.data && <p>Loading question...</p>}
      {submitAnswer.isError && (
        <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          Couldn&apos;t save that answer. Give it another go.
        </p>
      )}
    </div>
  );
}
