import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as masteryService from './mastery.service.js';

export async function getQualificationMastery(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = req.params as { qualificationSlug: string };
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const mastery = await masteryService.getQualificationMastery(
    learnerId,
    qualification.id,
  );

  res.status(200).json(mastery);
}
