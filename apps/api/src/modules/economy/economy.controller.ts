import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as economyService from './economy.service.js';
import { economyQuerySchema, recentEventsQuerySchema } from './economy.schema.js';

export async function getBalance(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = economyQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const balance = await economyService.getBalance(learnerId, qualification.id);

  res.status(200).json(balance);
}

export async function getRecentEvents(req: Request, res: Response): Promise<void> {
  const { qualificationSlug, limit } = recentEventsQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const events = await economyService.getRecentEvents(learnerId, qualification.id, limit);

  res.status(200).json(events);
}
