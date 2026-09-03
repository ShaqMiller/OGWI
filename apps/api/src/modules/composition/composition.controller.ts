import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as compositionService from './composition.service.js';
import { nextSessionQuerySchema } from './composition.schema.js';

export async function getNextSession(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = nextSessionQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const session = await compositionService.composeNextSession(learnerId, qualification.id);

  res.status(200).json(session);
}
