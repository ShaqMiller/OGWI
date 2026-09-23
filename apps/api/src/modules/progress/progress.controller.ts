import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import { weeklyActivityQuerySchema } from './progress.schema.js';
import * as progressService from './progress.service.js';

/**
 * Translates HTTP <-> domain calls only. No business rules, no Prisma.
 */

export async function getWeeklyActivity(req: Request, res: Response): Promise<void> {
  const query = weeklyActivityQuerySchema.parse(req.query);
  // requireLearner has already run and guarantees this is set.
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(query.qualificationSlug);
  const activity = await progressService.getWeeklyActivity(learnerId, qualification.id, query.weeksAgo);

  res.status(200).json(activity);
}
