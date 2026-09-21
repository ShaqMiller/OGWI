import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as publishingService from './publishing.service.js';

/**
 * Translates HTTP <-> domain calls only. No business rules, no Prisma.
 */

export async function publishSession(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = req.params as { qualificationSlug: string };
  // requireLearner has already run and guarantees this is set.
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const result = await publishingService.publishSession(learnerId, qualification.id);

  res.status(200).json(result);
}
