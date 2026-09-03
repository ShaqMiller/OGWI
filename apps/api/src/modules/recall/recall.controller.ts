import type { Request, Response } from 'express';
import { scoreTextRequestSchema } from '@ogwi/shared';
import * as recallService from './recall.service.js';
import { topicParamsSchema } from './recall.schema.js';

export async function getTopicKeyPoints(req: Request, res: Response): Promise<void> {
  const { topicId } = topicParamsSchema.parse(req.params);
  const result = await recallService.getTopicKeyPoints(topicId);

  res.status(200).json(result);
}

export async function scoreText(req: Request, res: Response): Promise<void> {
  const { topicId } = topicParamsSchema.parse(req.params);
  const { text } = scoreTextRequestSchema.parse(req.body);

  const result = await recallService.scoreText(topicId, text);

  res.status(200).json(result);
}
