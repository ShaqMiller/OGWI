import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as readinessService from './readiness.service.js';

export async function getReadiness(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = req.params as { qualificationSlug: string };
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const readiness = await readinessService.computeReadiness(
    learnerId,
    qualification.id,
    qualification.passMark,
  );

  res.status(200).json(readiness);
}
