'use client';

import { useState } from 'react';
import type { Qualification } from '@ogwi/shared';
import { useDueItems } from '@/hooks/scheduler/useDueItems';
import { useWrongAnswerPool } from '@/hooks/adaptive/useWrongAnswerPool';
import { ItemQueueQuiz } from '@/components/quiz/ItemQueueQuiz';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * One qualification's "Recommended" practice queues (Doc 2 A9 §4), trimmed
 * to the two that are backed by real, working endpoints: due-for-review
 * items (the scheduler) and items still being fixed (the adaptive
 * engine's wrong-answer pool). "Fixing gaps in: [Module]" batching skips
 * the spec's 5-item/7-day readiness gate on purpose - see docs/BUILD_ORDER.md
 * step 7's note. Separate component (not inlined in the page) because
 * hooks can't be called per-item inside a .map at the page level.
 */
export function QualificationPracticeSection({ qualification }: { qualification: Qualification }) {
  const dueItems = useDueItems(qualification.slug);
  const wrongAnswerPool = useWrongAnswerPool(qualification.slug);
  const [activeQueue, setActiveQueue] = useState<{ key: string; itemIds: string[] } | null>(null);

  const dueForReview = (dueItems.data ?? []).filter((item) => !item.isNew);

  const byModule = new Map<string, { moduleName: string; itemIds: string[] }>();
  for (const item of wrongAnswerPool.data ?? []) {
    const group = byModule.get(item.moduleId) ?? { moduleName: item.moduleName, itemIds: [] };
    group.itemIds.push(item.knowledgeItemId);
    byModule.set(item.moduleId, group);
  }

  const hasNothingToPractice = dueForReview.length === 0 && byModule.size === 0;

  function toggle(key: string, itemIds: string[]) {
    setActiveQueue((current) => (current?.key === key ? null : { key, itemIds }));
  }

  return (
    <Card style={{ margin: 'var(--space-4) 0' }}>
      <h2 style={{ margin: 0 }}>{qualification.name}</h2>

      {hasNothingToPractice && (
        <p style={{ color: 'var(--color-text-muted)' }}>Nothing to practice here right now.</p>
      )}

      {dueForReview.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <strong>Keeping fresh</strong> — {dueForReview.length} item
              {dueForReview.length === 1 ? '' : 's'} due for review
            </span>
            <Button
              variant="secondary"
              onClick={() => toggle('due', dueForReview.map((i) => i.knowledgeItemId))}
            >
              {activeQueue?.key === 'due' ? 'Hide' : 'Practice'}
            </Button>
          </p>
          {activeQueue?.key === 'due' && (
            <ItemQueueQuiz qualificationSlug={qualification.slug} itemIds={activeQueue.itemIds} />
          )}
        </div>
      )}

      {Array.from(byModule.entries()).map(([moduleId, group]) => {
        const key = `gap-${moduleId}`;
        return (
          <div key={moduleId} style={{ marginTop: 'var(--space-3)' }}>
            <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>Fixing gaps in: {group.moduleName}</strong> — {group.itemIds.length} item
                {group.itemIds.length === 1 ? '' : 's'}
              </span>
              <Button variant="secondary" onClick={() => toggle(key, group.itemIds)}>
                {activeQueue?.key === key ? 'Hide' : 'Practice'}
              </Button>
            </p>
            {activeQueue?.key === key && (
              <ItemQueueQuiz qualificationSlug={qualification.slug} itemIds={activeQueue.itemIds} />
            )}
          </div>
        );
      })}
    </Card>
  );
}
