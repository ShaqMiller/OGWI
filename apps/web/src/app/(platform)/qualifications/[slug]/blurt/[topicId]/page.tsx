'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTopicKeyPoints } from '@/hooks/recall/useTopicKeyPoints';
import { useScoreText } from '@/hooks/recall/useScoreText';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

/**
 * Blurting (Doc 2 B6): write everything you remember about a topic, then
 * see what you covered. The "marking" here is a keyword-matching
 * placeholder, not real understanding - see
 * apps/api/src/modules/recall/recall.service.ts. Nothing this page does
 * touches mastery, economy or flight - it's a standalone preview.
 */
export default function BlurtPage({ params }: { params: { slug: string; topicId: string } }) {
  const { slug, topicId } = params;
  const keyPoints = useTopicKeyPoints(topicId);
  const scoreText = useScoreText(topicId);
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    scoreText.mutate({ text });
  }

  function tryAgain() {
    scoreText.reset();
    setText('');
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/qualifications/${slug}`} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        ← Back
      </Link>

      <h1 style={{ marginTop: 'var(--space-2)' }}>Blurt: {keyPoints.data?.topicName ?? '...'}</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Write down everything you remember about this topic. Don&apos;t worry about phrasing.
      </p>

      {!scoreText.data && (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Start typing what you remember..."
            style={{
              width: '100%',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-3)',
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button onClick={submit} disabled={!text.trim() || scoreText.isPending}>
              {scoreText.isPending ? 'Checking...' : 'Check my blurt'}
            </Button>
          </div>
        </Card>
      )}

      {scoreText.data && (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{scoreText.data.coverage}% covered</h2>
            <Badge tone="warning">Placeholder scoring - matches keywords, not real understanding yet</Badge>
          </div>

          {scoreText.data.matched.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <strong>You covered:</strong>
              <ul>
                {scoreText.data.matched.map((kp) => (
                  <li key={kp.id} style={{ color: 'var(--color-success)' }}>
                    {kp.plainName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scoreText.data.unmatched.length > 0 && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <strong>Not mentioned yet:</strong>
              <ul>
                {scoreText.data.unmatched.map((kp) => (
                  <li key={kp.id} style={{ color: 'var(--color-text-muted)' }}>
                    {kp.plainName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={tryAgain}>
              Try again
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
