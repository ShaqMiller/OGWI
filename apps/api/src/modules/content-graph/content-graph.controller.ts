import type { Request, Response } from 'express';
import * as contentGraphService from './content-graph.service.js';
import {
  getKnowledgeItemParamsSchema,
  getQualificationParamsSchema,
} from './content-graph.schema.js';

/**
 * Translates HTTP <-> domain calls only. No business rules, no Prisma.
 */

export async function getQualification(req: Request, res: Response): Promise<void> {
  const { slug } = getQualificationParamsSchema.parse(req.params);
  const qualification = await contentGraphService.getQualificationBySlug(slug);
  res.status(200).json(qualification);
}

export async function listQualifications(_req: Request, res: Response): Promise<void> {
  const qualifications = await contentGraphService.listQualifications();
  res.status(200).json(qualifications);
}

export async function getKnowledgeItemPrompt(req: Request, res: Response): Promise<void> {
  const { id } = getKnowledgeItemParamsSchema.parse(req.params);
  const prompt = await contentGraphService.getKnowledgeItemPrompt(id);
  res.status(200).json(prompt);
}
