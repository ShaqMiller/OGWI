import { prisma } from '../../lib/prisma.js';
import type { TopicKeyPoints } from './recall.types.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function findTopicKeyPoints(topicId: string): Promise<TopicKeyPoints | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      name: true,
      objectives: {
        select: {
          keyPoints: {
            select: { id: true, plainName: true, cueQuestion: true, tier: true },
          },
        },
      },
    },
  });

  if (!topic) return null;

  return {
    topicName: topic.name,
    keyPoints: topic.objectives.flatMap((objective) => objective.keyPoints),
  };
}
