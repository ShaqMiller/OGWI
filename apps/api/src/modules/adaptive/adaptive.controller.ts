import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as adaptiveService from './adaptive.service.js';
import { adaptiveQuerySchema } from './adaptive.schema.js';

export async function getWrongAnswerPool(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = adaptiveQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const pool = await adaptiveService.getWrongAnswerPool(learnerId, qualification.id);

  res.status(200).json(pool);
}

export async function getGapQueue(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = adaptiveQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const queue = await adaptiveService.getGapQueue(learnerId, qualification.id);

  res.status(200).json(queue);
}
