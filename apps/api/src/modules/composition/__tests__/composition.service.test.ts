import { describe, expect, it } from 'vitest';
import type { PersistedCardFields } from '../../scheduler/fsrs.util.js';
import {
  findCurrentTopic,
  getTopicQuizItems,
  isTopicComplete,
  resolveActivitySlot,
} from '../composition.service.js';
import type { TopicWithObjectives } from '../composition.types.js';

function topic(overrides: Partial<TopicWithObjectives>): TopicWithObjectives {
  return {
    topicId: 'topic-1',
    topicName: 'Topic 1',
    topicOrder: 0,
    moduleId: 'module-1',
    moduleName: 'Module 1',
    moduleOrder: 0,
    hasActivitySlot: false,
    objectives: [],
    ...overrides,
  };
}

function reviewedState(stability: number, daysAgo: number): PersistedCardFields {
  const lastReviewedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    difficulty: 5,
    stability,
    due: new Date(lastReviewedAt.getTime() + 1),
    lastReviewedAt,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 'REVIEW',
  };
}

describe('isTopicComplete', () => {
  it('is false for a topic with no memory states at all', () => {
    const t = topic({ objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['i1', 'i2'] }] });
    expect(isTopicComplete(t, new Map())).toBe(false);
  });

  it('is true only once every item has a state', () => {
    const t = topic({ objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['i1', 'i2'] }] });
    const partial = new Map([['i1', reviewedState(5, 1)]]);
    expect(isTopicComplete(t, partial)).toBe(false);

    const full = new Map([
      ['i1', reviewedState(5, 1)],
      ['i2', reviewedState(5, 1)],
    ]);
    expect(isTopicComplete(t, full)).toBe(true);
  });

  it('is false for a topic with zero knowledge items (nothing to complete)', () => {
    const t = topic({ objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: [] }] });
    expect(isTopicComplete(t, new Map())).toBe(false);
  });
});

describe('findCurrentTopic', () => {
  it('returns the first incomplete topic in module/topic order', () => {
    const t1 = topic({
      topicId: 't1',
      topicOrder: 0,
      objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['i1'] }],
    });
    const t2 = topic({
      topicId: 't2',
      topicOrder: 1,
      objectives: [{ id: 'o2', kind: 'FACT_HEAVY', knowledgeItemIds: ['i2'] }],
    });

    const states = new Map([['i1', reviewedState(5, 1)]]); // t1 complete, t2 not

    const current = findCurrentTopic([t2, t1], states); // deliberately out of order input
    expect(current?.topicId).toBe('t2');
  });

  it('returns null once every topic is complete', () => {
    const t1 = topic({
      topicId: 't1',
      objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['i1'] }],
    });
    const states = new Map([['i1', reviewedState(5, 1)]]);

    expect(findCurrentTopic([t1], states)).toBeNull();
  });
});

describe('getTopicQuizItems', () => {
  it('puts every uncovered item ahead of covered items', () => {
    const t = topic({
      objectives: [
        { id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['covered-1', 'new-1'] },
      ],
    });
    const states = new Map([['covered-1', reviewedState(30, 1)]]);

    const items = getTopicQuizItems(t, states, new Date(), 10);
    expect(items[0]).toMatchObject({ knowledgeItemId: 'new-1', isNew: true });
    expect(items[1]).toMatchObject({ knowledgeItemId: 'covered-1', isNew: false });
  });

  it('orders covered items by retrievability ascending (weakest first)', () => {
    const t = topic({
      objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['strong', 'weak'] }],
    });
    // Same elapsed time, higher stability -> higher retrievability -> "weak" (low stability) should sort first.
    const states = new Map([
      ['strong', reviewedState(60, 30)],
      ['weak', reviewedState(2, 30)],
    ]);

    const items = getTopicQuizItems(t, states, new Date(), 10);
    expect(items.map((i) => i.knowledgeItemId)).toEqual(['weak', 'strong']);
  });

  it('respects the limit', () => {
    const t = topic({
      objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: ['a', 'b', 'c'] }],
    });
    const items = getTopicQuizItems(t, new Map(), new Date(), 2);
    expect(items).toHaveLength(2);
  });
});

describe('resolveActivitySlot', () => {
  it('returns null when the topic has no activity slot', () => {
    const t = topic({
      hasActivitySlot: false,
      objectives: [{ id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: [] }],
    });
    expect(resolveActivitySlot(t)).toBeNull();
  });

  it('resolves to blurt when fact-heavy objectives dominate', () => {
    const t = topic({
      hasActivitySlot: true,
      objectives: [
        { id: 'o1', kind: 'FACT_HEAVY', knowledgeItemIds: [] },
        { id: 'o2', kind: 'FACT_HEAVY', knowledgeItemIds: [] },
        { id: 'o3', kind: 'CONCEPTUAL', knowledgeItemIds: [] },
      ],
    });
    expect(resolveActivitySlot(t)).toBe('blurt');
  });

  it('resolves to teach when conceptual objectives dominate', () => {
    const t = topic({
      hasActivitySlot: true,
      objectives: [
        { id: 'o1', kind: 'CONCEPTUAL', knowledgeItemIds: [] },
        { id: 'o2', kind: 'CONCEPTUAL', knowledgeItemIds: [] },
        { id: 'o3', kind: 'FACT_HEAVY', knowledgeItemIds: [] },
      ],
    });
    expect(resolveActivitySlot(t)).toBe('teach');
  });

  it('resolves to null on an exact tie (no usage history to break it)', () => {
    const t = topic({
      hasActivitySlot: true,
      objectives: [
        { id: 'o1', kind: 'CONCEPTUAL', knowledgeItemIds: [] },
        { id: 'o2', kind: 'FACT_HEAVY', knowledgeItemIds: [] },
      ],
    });
    expect(resolveActivitySlot(t)).toBeNull();
  });
});
