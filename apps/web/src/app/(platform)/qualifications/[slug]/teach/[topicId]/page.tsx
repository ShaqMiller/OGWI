'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTopicKeyPoints } from '@/hooks/recall/useTopicKeyPoints';
import { useScoreText } from '@/hooks/recall/useScoreText';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Message {
  from: 'oggi' | 'learner';
  text: string;
}

const CLOSING_MESSAGE = "That's everything on this topic - nice teaching.";

/**
 * Teach Oggi (Doc 2 B7): explain the topic to Oggi, one key point at a
 * time. Oggi's cue questions are genuinely deterministic (cycle through
 * the topic's key points in order) - the placeholder part is judging
 * whether an answer covered the point, which reuses the same
 * keyword-matching endpoint as Blurt. Client-side turn state only;
 * nothing here is persisted or wired into mastery/economy/flight.
 */
export default function TeachOggiPage({ params }: { params: { slug: string; topicId: string } }) {
  const { slug, topicId } = params;
  const keyPoints = useTopicKeyPoints(topicId);
  const scoreText = useScoreText(topicId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [taughtIds, setTaughtIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!keyPoints.data || messages.length > 0) return;

    const first = keyPoints.data.keyPoints[0];
    setMessages(first ? [{ from: 'oggi', text: first.cueQuestion }] : []);
  }, [keyPoints.data, messages.length]);

  function nextUntaught(taught: Set<string>) {
    return keyPoints.data?.keyPoints.find((kp) => !taught.has(kp.id)) ?? null;
  }

  async function send() {
    if (!input.trim() || !keyPoints.data) return;

    const learnerText = input;
    setMessages((prev) => [...prev, { from: 'learner', text: learnerText }]);
    setInput('');

    const result = await scoreText.mutateAsync({ text: learnerText });
    const newlyMatched = result.matched.filter((kp) => !taughtIds.has(kp.id));
    const updatedTaught = new Set(taughtIds);
    newlyMatched.forEach((kp) => updatedTaught.add(kp.id));
    setTaughtIds(updatedTaught);

    const ackLine =
      newlyMatched.length > 0
        ? `Got it - that covers: ${newlyMatched.map((kp) => kp.plainName).join(', ')}.`
        : "I didn't catch a new point there - want to add more?";

    const next = nextUntaught(updatedTaught);

    setMessages((prev) => [
      ...prev,
      { from: 'oggi', text: ackLine },
      { from: 'oggi', text: next ? next.cueQuestion : CLOSING_MESSAGE },
    ]);

    if (!next) setDone(true);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/qualifications/${slug}`} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        ← Back
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
        <h1 style={{ margin: 0 }}>Teach Oggi: {keyPoints.data?.topicName ?? '...'}</h1>
        <Badge tone="warning">Placeholder scoring - matches keywords, not real understanding yet</Badge>
      </div>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Explain the topic to Oggi like they&apos;ve never heard of it.
      </p>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.map((message, i) => (
            <div
              key={i}
              style={{
                alignSelf: message.from === 'oggi' ? 'flex-start' : 'flex-end',
                maxWidth: '80%',
                background: message.from === 'oggi' ? 'var(--color-border)' : 'var(--color-primary)',
                color: message.from === 'oggi' ? 'var(--color-text)' : '#0a0a0a',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius)',
              }}
            >
              {message.text}
            </div>
          ))}
        </div>

        {!done && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type your explanation..."
              style={{
                flex: 1,
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
                fontSize: '0.95rem',
              }}
            />
            <Button onClick={send} disabled={!input.trim() || scoreText.isPending}>
              Send
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
