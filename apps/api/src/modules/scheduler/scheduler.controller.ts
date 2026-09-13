import { submitAnswerRequestSchema } from '@ogwi/shared';
import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import { dueItemsQuerySchema, reviewLogQuerySchema } from './scheduler.schema.js';
import * as schedulerService from './scheduler.service.js';

export async function submitAnswer(req: Request, res: Response): Promise<void> {
  const body = submitAnswerRequestSchema.parse(req.body);
  // requireLearner has already run and guarantees this is set.
  const learnerId = req.learnerId as string;

  const result = await schedulerService.submitAnswer(
    learnerId,
    body.knowledgeItemId,
    body.renderingId,
    body.answer,
    body.attemptId,
  );

  res.status(200).json(result);
}

export async function getDueItems(req: Request, res: Response): Promise<void> {
  const query = dueItemsQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(query.qualificationSlug);
  const items = await schedulerService.getDueItems(learnerId, qualification.id, query.limit);

  res.status(200).json(items);
}

export async function getReviewLog(req: Request, res: Response): Promise<void> {
  const query = reviewLogQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(query.qualificationSlug);
  const log = await schedulerService.getReviewLog(learnerId, qualification.id, query.limit);

  res.status(200).json(log);
}
