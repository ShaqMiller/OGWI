import { saveExamAnswerRequestSchema, startExamRunRequestSchema } from '@ogwi/shared';
import type { Request, Response } from 'express';
import { examRunParamsSchema } from './exam.schema.js';
import * as examService from './exam.service.js';

/**
 * Translates HTTP <-> domain calls only. No business rules, no Prisma.
 */

export async function startExamRun(req: Request, res: Response): Promise<void> {
  const body = startExamRunRequestSchema.parse(req.body);
  // requireLearner has already run and guarantees this is set.
  const learnerId = req.learnerId as string;

  const result = await examService.startRun(learnerId, body.qualificationSlug);

  res.status(201).json(result);
}

export async function getExamPaper(req: Request, res: Response): Promise<void> {
  const { runId } = examRunParamsSchema.parse(req.params);
  const learnerId = req.learnerId as string;

  const paper = await examService.getPaper(runId, learnerId);

  res.status(200).json(paper);
}

export async function saveExamAnswer(req: Request, res: Response): Promise<void> {
  const { runId } = examRunParamsSchema.parse(req.params);
  const body = saveExamAnswerRequestSchema.parse(req.body);
  const learnerId = req.learnerId as string;

  await examService.saveAnswer(runId, learnerId, body.knowledgeItemId, body.selectedOptionIndex);

  // Acknowledgement only - a save must never hint at correctness.
  res.status(200).json({ saved: true });
}

export async function submitExamRun(req: Request, res: Response): Promise<void> {
  const { runId } = examRunParamsSchema.parse(req.params);
  const learnerId = req.learnerId as string;

  const results = await examService.submitRun(runId, learnerId);

  res.status(200).json(results);
}

export async function getExamResults(req: Request, res: Response): Promise<void> {
  const { runId } = examRunParamsSchema.parse(req.params);
  const learnerId = req.learnerId as string;

  const results = await examService.getResults(runId, learnerId);

  res.status(200).json(results);
}
