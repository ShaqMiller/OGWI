import type { Request, Response } from 'express';
import { checkHealth } from './health.service.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await checkHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
}
