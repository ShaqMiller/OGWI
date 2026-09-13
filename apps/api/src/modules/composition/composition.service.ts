import type { ActivitySlot, NextSession } from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import { liveRetrievability, type PersistedCardFields } from '../scheduler/fsrs.util.js';
import * as schedulerService from '../scheduler/scheduler.service.js';
import * as compositionRepository from './composition.repository.js';
import type { CompositionDueItem, TopicWithObjectives } from './composition.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Scope note: the spec's full session composer also assigns each topic one
 * of ~8 named flow templates and enforces rotation constraints across
 * them. That library is explicitly still an open decision in the handover
 * (Part D #5, "authored during content production") - it isn't invented
 * here. This module works with whatever a topic's `flowTemplate` /
 * `hasActivitySlot` fields already say, once content authoring sets them.
 */

const DEFAULT_TOPIC_QUIZ_LIMIT = 8;

function allItemIds(topic: TopicWithObjectives): string[] {
  return topic.objectives.flatMap((o) => o.knowledgeItemIds);
}

export function isTopicComplete(
  topic: TopicWithObjectives,
  states: Map<string, PersistedCardFields>,
): boolean {
  const items = allItemIds(topic);
  return items.length > 0 && items.every((id) => states.has(id));
}

export function findCurrentTopic(
  topics: TopicWithObjectives[],
  states: Map<string, PersistedCardFields>,
): TopicWithObjectives | null {
  const ordered = [...topics].sort(
    (a, b) => a.moduleOrder - b.moduleOrder || a.topicOrder - b.topicOrder,
  );
  return ordered.find((topic) => !isTopicComplete(topic, states)) ?? null;
}

/**
 * Slot-fill (Doc 2 B5): uncovered new items first - every new item gets
 * retrieved at least once before the topic can complete - then by
 * retrievability ascending among items already covered.
 */
export function getTopicQuizItems(
  topic: TopicWithObjectives,
  states: Map<string, PersistedCardFields>,
  now: Date,
  limit = DEFAULT_TOPIC_QUIZ_LIMIT,
): CompositionDueItem[] {
  const uncovered: CompositionDueItem[] = [];
  const covered: { knowledgeItemId: string; r: number; due: Date }[] = [];

  for (const item of allItemIds(topic)) {
    const state = states.get(item);
    if (!state) {
      uncovered.push({ knowledgeItemId: item, due: null, isNew: true });
    } else {
      covered.push({ knowledgeItemId: item, r: liveRetrievability(state, now), due: state.due });
    }
  }

  covered.sort((a, b) => a.r - b.r);

  return [
    ...uncovered,
    ...covered.map((c) => ({ knowledgeItemId: c.knowledgeItemId, due: c.due, isNew: false })),
  ].slice(0, limit);
}

/**
 * Majority fact-heavy -> blurt, majority conceptual -> teach (Doc 2 B5).
 * The real rule breaks an exact tie by "whichever the learner has done
 * less recently" - no usage history exists yet since neither activity is
 * built, so a tie resolves to null (undecided) rather than guessing.
 */
export function resolveActivitySlot(topic: TopicWithObjectives): ActivitySlot {
  if (!topic.hasActivitySlot) return null;

  const factHeavy = topic.objectives.filter((o) => o.kind === 'FACT_HEAVY').length;
  const conceptual = topic.objectives.filter((o) => o.kind === 'CONCEPTUAL').length;

  if (factHeavy > conceptual) return 'blurt';
  if (conceptual > factHeavy) return 'teach';
  return null;
}

export async function composeNextSession(
  learnerId: string,
  qualificationId: string,
): Promise<NextSession> {
  const now = clock.now();
  const topics = await compositionRepository.findTopicsForQualification(qualificationId);
  const allIds = topics.flatMap(allItemIds);
  const states = await compositionRepository.findItemStates(learnerId, allIds);

  const currentTopic = findCurrentTopic(topics, states);
  const opener = await schedulerService.getDueItems(learnerId, qualificationId, 6);

  return {
    opener,
    currentTopic: currentTopic
      ? {
          topicId: currentTopic.topicId,
          topicName: currentTopic.topicName,
          moduleId: currentTopic.moduleId,
          moduleName: currentTopic.moduleName,
        }
      : null,
    topicQuizItems: currentTopic ? getTopicQuizItems(currentTopic, states, now) : [],
    activitySlot: currentTopic ? resolveActivitySlot(currentTopic) : null,
    qualificationComplete: topics.length > 0 && currentTopic === null,
  };
}
