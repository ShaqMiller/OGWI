'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQualification } from '@/hooks/content-graph/useQualification';
import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';
import { useMastery } from '@/hooks/mastery/useMastery';
import { useNextSession } from '@/hooks/composition/useNextSession';
import { useEconomyBalance } from '@/hooks/economy/useEconomyBalance';
import { useGradeReview } from '@/hooks/scheduler/useGradeReview';
import { useTopicKeyPoints } from '@/hooks/recall/useTopicKeyPoints';
import { ModuleMasteryBar } from '@/components/mastery/ModuleMasteryBar';
import { MultipleChoiceOptions } from '@/components/quiz/MultipleChoiceOptions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * A functional-but-plain dashboard + quiz screen, standing in until real
 * designs arrive. Purpose: prove the backend built so far (mastery,
 * composition, economy, scheduler) works end to end by making it
 * clickable, not just curl-able. Every number here is live from the API -
 * nothing is mocked in this component.
 *
 * There is no real answer-checking system yet (Doc 2's quiz UI doesn't
 * exist), so this checks the multiple-choice answer client-side against
 * the rendering's correctOptionIndex and grades good/again accordingly -
 * a reasonable stand-in, not the final design.
 */
export default function QualificationDashboardPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const qualification = useQualification(slug);
  const mastery = useMastery(slug);
  const nextSession = useNextSession(slug);
  const balance = useEconomyBalance(slug);
  const gradeReview = useGradeReview(slug);
  const currentTopicId = nextSession.data?.currentTopic?.topicId ?? null;
  const topicKeyPoints = useTopicKeyPoints(currentTopicId);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const currentItem = nextSession.data?.topicQuizItems[0] ?? null;
  const prompt = useKnowledgeItemPrompt(currentItem?.knowledgeItemId ?? null);

  function selectOption(index: number) {
    if (selectedOption !== null || !prompt.data || !currentItem) return;

    setSelectedOption(index);
    const isCorrect = index === prompt.data.correctOptionIndex;

    gradeReview.mutate(
      { knowledgeItemId: currentItem.knowledgeItemId, grade: isCorrect ? 'good' : 'again' },
      { onSuccess: () => setTimeout(() => setSelectedOption(null), 900) },
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>{qualification.data?.name ?? slug}</h1>

      <div
        style={{
          margin: 'var(--space-3) 0 var(--space-4)',
          color: 'var(--color-text-muted)',
        }}
      >
        <strong style={{ color: 'var(--color-text)' }}>{balance.data?.totalPoints ?? '—'}</strong>{' '}
        points
      </div>

      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <h2 style={{ marginTop: 0 }}>Mastery</h2>
        {mastery.isLoading && <p>Loading...</p>}
        {mastery.data?.map((m) => (
          <ModuleMasteryBar key={m.moduleId} mastery={m} />
        ))}
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Next up</h2>
        {nextSession.data?.qualificationComplete && (
          <p>You&apos;ve covered everything in this test course. Nice work.</p>
        )}
        {nextSession.data?.currentTopic && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>
              {nextSession.data.currentTopic.topicName}
            </strong>{' '}
            · {nextSession.data.currentTopic.moduleName}
            {nextSession.data.activitySlot && <> · would end in a {nextSession.data.activitySlot} exercise</>}
          </p>
        )}

        {currentTopicId && topicKeyPoints.data && topicKeyPoints.data.keyPoints.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
            <Button variant="secondary" onClick={() => router.push(`/qualifications/${slug}/blurt/${currentTopicId}`)}>
              Blurt this topic
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/qualifications/${slug}/teach/${currentTopicId}`)}>
              Teach Oggi this topic
            </Button>
          </div>
        )}

        {currentItem && prompt.data && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p>{prompt.data.prompt}</p>
            <MultipleChoiceOptions
              options={prompt.data.options}
              correctOptionIndex={prompt.data.correctOptionIndex}
              selectedOption={selectedOption}
              onSelect={selectOption}
            />
          </div>
        )}

        {currentItem && !prompt.data && <p>Loading question...</p>}
        {!currentItem && !nextSession.data?.qualificationComplete && <p>Loading...</p>}
      </Card>
    </div>
  );
}
