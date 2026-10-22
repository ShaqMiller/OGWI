'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQualification } from '@/hooks/content-graph/useQualification';
import { useKnowledgeItemPrompt } from '@/hooks/content-graph/useKnowledgeItemPrompt';
import { useMastery } from '@/hooks/mastery/useMastery';
import { usePublishSession } from '@/hooks/publishing/usePublishSession';
import { useNextSession } from '@/hooks/composition/useNextSession';
import { useEconomyBalance } from '@/hooks/economy/useEconomyBalance';
import { useFlightState } from '@/hooks/flight/useFlightState';
import { useSubmitAnswer } from '@/hooks/scheduler/useSubmitAnswer';
import { useTopicKeyPoints } from '@/hooks/recall/useTopicKeyPoints';
import { ModuleMasteryBar } from '@/components/mastery/ModuleMasteryBar';
import { MultipleChoiceOptions } from '@/components/quiz/MultipleChoiceOptions';
import { FlightSky, flightStatusLine } from '@/components/flight/FlightSky';
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
  const flight = useFlightState(slug);
  const submitAnswer = useSubmitAnswer(slug);
  const currentTopicId = nextSession.data?.currentTopic?.topicId ?? null;
  const topicKeyPoints = useTopicKeyPoints(currentTopicId);
  const publishMastery = usePublishSession(slug);
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

  // A snapshot of the question being answered. onSuccess invalidates
  // composition, so the next item usually arrives before the feedback pause
  // is over; rendering from the snapshot keeps the answered question and its
  // verdict on screen for the whole pause instead of swapping in the next one.
  const [answered, setAnswered] = useState<{
    prompt: string;
    options: string[];
    selectedOption: number;
    correctOptionIndex: number | null;
  } | null>(null);

  const currentItem = nextSession.data?.topicQuizItems[0] ?? null;
  const prompt = useKnowledgeItemPrompt(currentItem?.knowledgeItemId ?? null);

  function selectOption(index: number) {
    if (answered !== null || !prompt.data || !currentItem) return;

    setAnswered({
      prompt: prompt.data.prompt,
      options: prompt.data.options,
      selectedOption: index,
      correctOptionIndex: null,
    });

    submitAnswer.mutate(
      {
        knowledgeItemId: currentItem.knowledgeItemId,
        renderingId: prompt.data.renderingId,
        answer: { kind: 'option_index', selectedOptionIndex: index },
      },
      {
        onSuccess: (result) => {
          setAnswered(
            (current) => current && { ...current, correctOptionIndex: result.correctOptionIndex },
          );
          setTimeout(() => setAnswered(null), 900);
        },
        // Unlock so the learner can retry rather than being stranded on a
        // locked, unmarked question.
        onError: () => setAnswered(null),
      },
    );
  }

  const shownQuestion =
    answered ??
    (currentItem && prompt.data
      ? { ...prompt.data, selectedOption: null, correctOptionIndex: null }
      : null);

  return (
    <div style={{ maxWidth: 760 }}>
      <Card style={{ marginBottom: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
        <FlightSky flight={flight.data} />
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            {qualification.data?.name ?? slug}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 600, lineHeight: 1.1 }}>
              {balance.data?.totalPoints ?? '—'}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>points</span>
          </div>
          {flight.data && (
            <div style={{ color: 'var(--color-balloon-light)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
              {flightStatusLine(flight.data)}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Mastery</h2>
            <Button variant="secondary" disabled={publishMastery.isPending} onClick={() => publish()}>
              End session
            </Button>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 'var(--space-1) 0 var(--space-3)' }}>
            Updates when you end a session or finish a topic.
          </p>
          {mastery.isLoading && <p>Loading...</p>}
          {mastery.data?.modules.map((m) => (
            <ModuleMasteryBar key={m.moduleId} mastery={m} />
          ))}
        </div>
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

        {shownQuestion && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <p>{shownQuestion.prompt}</p>
            <MultipleChoiceOptions
              options={shownQuestion.options}
              correctOptionIndex={shownQuestion.correctOptionIndex}
              selectedOption={shownQuestion.selectedOption}
              onSelect={selectOption}
            />
          </div>
        )}

        {submitAnswer.isError && (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            Couldn&apos;t save that answer. Give it another go.
          </p>
        )}

        {!answered && currentItem && !prompt.data && <p>Loading question...</p>}
        {!answered && !currentItem && !nextSession.data?.qualificationComplete && <p>Loading...</p>}
      </Card>
    </div>
  );
}
