'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQualification } from '@/hooks/content-graph/useQualification';
import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';
import { useMastery } from '@/hooks/mastery/useMastery';
import { usePublishMastery } from '@/hooks/mastery/usePublishMastery';
import { useNextSession } from '@/hooks/composition/useNextSession';
import { useEconomyBalance } from '@/hooks/economy/useEconomyBalance';
import { useSubmitAnswer } from '@/hooks/scheduler/useSubmitAnswer';
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
 * Answers are marked server-side (POST /api/scheduler/answers): this sends
 * the chosen option and the rendering it was shown for, and the response
 * carries both the verdict and the correct option. The browser never sees
 * an answer key before the learner has committed to one.
 */
export default function QualificationDashboardPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const qualification = useQualification(slug);
  const mastery = useMastery(slug);
  const nextSession = useNextSession(slug);
  const balance = useEconomyBalance(slug);
  const submitAnswer = useSubmitAnswer(slug);
  const currentTopicId = nextSession.data?.currentTopic?.topicId ?? null;
  const topicKeyPoints = useTopicKeyPoints(currentTopicId);
  const publishMastery = usePublishMastery(slug);
  const { mutate: publish } = publishMastery;

  // Finishing a topic is a session end (Doc 2 C4): composition moves on to the
  // next topic, or reports the course complete, and mastery publishes. That and
  // the End session button are the only things on this page that move the
  // mastery bars - answering a question never does.
  const previousTopicId = useRef<string | null>(null);
  const sessionLoaded = nextSession.data !== undefined;
  useEffect(() => {
    if (!sessionLoaded) return;
    const previous = previousTopicId.current;
    previousTopicId.current = currentTopicId;
    if (previous !== null && previous !== currentTopicId) publish();
  }, [sessionLoaded, currentTopicId, publish]);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  // Tagged with the item it belongs to. onSuccess invalidates composition,
  // so the next item can arrive while feedback is still showing - untagged,
  // one question's answer key would get painted onto a different question.
  const [marked, setMarked] = useState<{ itemId: string; correctOptionIndex: number } | null>(null);

  const currentItem = nextSession.data?.topicQuizItems[0] ?? null;
  const prompt = useKnowledgeItemPrompt(currentItem?.knowledgeItemId ?? null);

  function selectOption(index: number) {
    if (selectedOption !== null || !prompt.data || !currentItem) return;

    const answeredItemId = currentItem.knowledgeItemId;
    setSelectedOption(index);

    submitAnswer.mutate(
      {
        knowledgeItemId: answeredItemId,
        renderingId: prompt.data.renderingId,
        answer: { kind: 'option_index', selectedOptionIndex: index },
      },
      {
        onSuccess: (result) => {
          setMarked({ itemId: answeredItemId, correctOptionIndex: result.correctOptionIndex });
          setTimeout(() => {
            setSelectedOption(null);
            setMarked(null);
          }, 900);
        },
        // Unlock so the learner can retry rather than being stranded on a
        // locked, unmarked question.
        onError: () => setSelectedOption(null),
      },
    );
  }

  const markedForCurrentItem =
    marked && marked.itemId === currentItem?.knowledgeItemId ? marked.correctOptionIndex : null;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Mastery</h2>
          <Button variant="secondary" disabled={publishMastery.isPending} onClick={() => publish()}>
            End session
          </Button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Updates when you end a session or finish a topic.
        </p>
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
              correctOptionIndex={markedForCurrentItem}
              selectedOption={selectedOption}
              onSelect={selectOption}
            />
          </div>
        )}

        {submitAnswer.isError && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            Couldn&apos;t save that answer. Give it another go.
          </p>
        )}

        {currentItem && !prompt.data && <p>Loading question...</p>}
        {!currentItem && !nextSession.data?.qualificationComplete && <p>Loading...</p>}
      </Card>
    </div>
  );
}
