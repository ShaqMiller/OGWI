import { prisma } from '../../lib/prisma.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unreachable';
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok' };
  } catch {
    return { status: 'degraded', database: 'unreachable' };
  }
}
