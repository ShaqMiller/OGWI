'use client';

import type { UnlockChecklist, UnlockChecklistItem } from '@ogwi/shared';

function label(item: UnlockChecklistItem): string {
  switch (item.key) {
    case 'first_topic':
      return 'Complete your first topic';
    case 'modules':
      return item.required === 1
        ? 'Answer questions from the course'
        : `Answer questions across ${item.required} modules (${item.current} of ${item.required})`;
    case 'first_exam_run':
      return 'Complete one exam simulation';
  }
}

/**
 * The first-score unlock (Doc 2 B2). The odds of passing don't exist until
 * all three are done, which guarantees the first number a learner ever sees
 * was calibrated against an exam-condition run.
 *
 * `scorePublished` says whether an unlocked score has already been published.
 * The checklist itself is live, so it can be complete while the score still
 * waits for the next publish point - that gap is the only time the "arrives
 * when you finish this session" note is true.
 */
export function ReadinessUnlockChecklist({
  checklist,
  scorePublished,
}: {
  checklist: UnlockChecklist;
  scorePublished: boolean;
}) {
  return (
    <div style={{ marginTop: 'var(--space-3)', fontSize: '0.9rem' }}>
      <div>Your odds of passing unlock once you&apos;ve done these:</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-2) 0 0' }}>
        {checklist.items.map((item) => (
          <li
            key={item.key}
            aria-label={`${label(item)}: ${item.done ? 'done' : 'not yet'}`}
            style={{ color: item.done ? 'var(--color-text)' : 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}
          >
            <span aria-hidden="true" style={{ display: 'inline-block', width: '1.4em' }}>
              {item.done ? '✓' : '○'}
            </span>
            {label(item)}
          </li>
        ))}
      </ul>
      {checklist.unlocked && !scorePublished && (
        <p style={{ color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0' }}>
          All done - your first readiness score arrives when you finish this session.
        </p>
      )}
    </div>
  );
}
