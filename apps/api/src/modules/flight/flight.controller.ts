import type { Request, Response } from 'express';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as flightService from './flight.service.js';
import { flightQuerySchema } from './flight.schema.js';

export async function getFlightState(req: Request, res: Response): Promise<void> {
  const { qualificationSlug } = flightQuerySchema.parse(req.query);
  const learnerId = req.learnerId as string;

  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const state = await flightService.getFlightState(learnerId, qualification.id);

  res.status(200).json(state);
}

// Awards are learner-global, not per-qualification - no qualificationSlug here.
export async function getAwards(req: Request, res: Response): Promise<void> {
  const learnerId = req.learnerId as string;
  const awards = await flightService.getAwards(learnerId);

  res.status(200).json(awards);
}
