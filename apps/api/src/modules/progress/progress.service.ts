import type { WeeklyActivity } from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as compositionService from '../composition/composition.service.js';
import * as progressRepository from './progress.repository.js';
import { weekContaining, utcDay } from './week.util.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Doc 2 A10 part 2, "This week so far": a seven-day chart of litres earned per
 * day plus a weekly summary, with previous weeks skimmable. Empty days are
 * simply empty - no nagging, no zero-shaming (A2's award law: "awards
 * celebrate and never nag").
 */
export async function getWeeklyActivity(
  learnerId: string,
  qualificationId: string,
  weeksAgo: number,
): Promise<WeeklyActivity> {
  const now = clock.now();
  const week = weekContaining(now, weeksAgo);

  const [litresByDay, answers, sessions, firstAnsweredAt, topics] = await Promise.all([
    progressRepository.findLitresByDay(learnerId, qualificationId, week.start, week.end),
    progressRepository.countAnswers(learnerId, qualificationId, week.start, week.end),
    progressRepository.countSessions(learnerId, qualificationId, week.start, week.end),
    progressRepository.findFirstAnsweredAt(learnerId, qualificationId),
    compositionService.listTopicItemIds(qualificationId),
  ]);

  const days = week.days.map((date) => ({ date, litres: litresByDay.get(date) ?? 0 }));

  return {
    weekStart: utcDay(week.start),
    isCurrentWeek: weeksAgo === 0,
    days,
    totals: {
      litres: days.reduce((sum, day) => sum + day.litres, 0),
      answers,
      sessions,
      topicsCompleted: countTopicsCompletedIn(topics, firstAnsweredAt, week.start, week.end),
    },
  };
}

/**
 * A topic counts as completed in the week its LAST unanswered item was first
 * answered - the same "every item attempted" rule composition uses to move on.
 */
function countTopicsCompletedIn(
  topics: { topicId: string; knowledgeItemIds: string[] }[],
  firstAnsweredAt: Map<string, Date>,
  from: Date,
  to: Date,
): number {
  return topics.filter((topic) => {
    if (topic.knowledgeItemIds.length === 0) return false;

    let completedAt = 0;
    for (const itemId of topic.knowledgeItemIds) {
      const answeredAt = firstAnsweredAt.get(itemId);
      if (!answeredAt) return false; // still unfinished
      completedAt = Math.max(completedAt, answeredAt.getTime());
    }

    return completedAt >= from.getTime() && completedAt < to.getTime();
  }).length;
}
