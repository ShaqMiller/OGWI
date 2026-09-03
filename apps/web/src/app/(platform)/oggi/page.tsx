'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Message {
  from: 'oggi' | 'learner';
  text: string;
}

const CANNED_REPLIES = [
  "I hear you - once my real brain is wired up, I'll be able to dig into that properly.",
  'Good question. For now this is just a preview of what our chats will look like.',
  "I'll be grounded in your actual course content soon - ask me anything once that's live.",
  'Noted! Right now I can only chat, not actually help with your studying yet.',
];

/**
 * Oggi's conversational layer (Doc 2 B12) is the last of the twelve
 * systems and needs real grounding in a learner's content-graph and
 * engine states - well beyond what "make it a placeholder" calls for.
 * This page is fully client-side: no backend call, a short rotation of
 * canned replies, explicitly labelled as a preview of the chat shell.
 */
export default function OggiPage() {
  const [messages, setMessages] = useState<Message[]>([
    { from: 'oggi', text: "Hi, I'm Oggi. Ask me anything - though I'm just a preview for now." },
  ]);
  const [input, setInput] = useState('');
  const [replyIndex, setReplyIndex] = useState(0);

  function send() {
    if (!input.trim()) return;

    const reply = CANNED_REPLIES[replyIndex % CANNED_REPLIES.length] as string;
    setReplyIndex((i) => i + 1);

    setMessages((prev) => [...prev, { from: 'learner', text: input }, { from: 'oggi', text: reply }]);
    setInput('');
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Oggi</h1>
        <Badge tone="warning">Preview - Oggi&apos;s real AI brain is coming soon</Badge>
      </div>
      <p style={{ color: 'var(--color-text-muted)' }}>
        This is a shell of the chat experience. Nothing you type here is understood or saved.
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

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask Oggi something..."
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
          <Button onClick={send} disabled={!input.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
