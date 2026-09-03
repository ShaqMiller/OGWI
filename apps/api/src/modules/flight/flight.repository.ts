import { randomUUID } from 'node:crypto';
import { PHYSICS_CONFIG_VERSION } from '@ogwi/shared';
import { prisma } from '../../lib/prisma.js';
import type { PumpEventRecord } from './flight.types.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function findOpenFlightId(
  learnerId: string,
  qualificationId: string,
): Promise<string | null> {
  const flight = await prisma.flight.findFirst({
    where: { learnerId, qualificationId, events: { none: { eventType: 'TOUCHDOWN' } } },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });

  return flight?.id ?? null;
}

export async function createFlight(
  learnerId: string,
  qualificationId: string,
  startedAt: Date,
): Promise<string> {
  const flight = await prisma.flight.create({
    data: { learnerId, qualificationId, startedAt },
    select: { id: true },
  });

  return flight.id;
}

export async function findPumpEvents(flightId: string): Promise<PumpEventRecord[]> {
  const rows = await prisma.flightEvent.findMany({
    where: { flightId, eventType: 'PUMP' },
    orderBy: { effectiveAt: 'asc' },
    select: { payload: true, effectiveAt: true },
  });

  return rows.map((row) => ({
    amount: (row.payload as { amount: number }).amount,
    effectiveAt: row.effectiveAt,
  }));
}

export async function recordPump(
  flightId: string,
  learnerId: string,
  amount: number,
  effectiveAt: Date,
): Promise<void> {
  await prisma.flightEvent.create({
    data: {
      flightId,
      learnerId,
      eventType: 'PUMP',
      effectiveAt,
      payload: { amount },
      // No client-supplied request id exists yet for true idempotency -
      // same simplification noted in the economy module.
      idempotencyKey: randomUUID(),
      physicsConfigVersion: PHYSICS_CONFIG_VERSION,
    },
  });
}

export async function recordLiftoff(
  flightId: string,
  learnerId: string,
  effectiveAt: Date,
  fill: number,
): Promise<void> {
  await prisma.flightEvent.create({
    data: {
      flightId,
      learnerId,
      eventType: 'LIFTOFF',
      effectiveAt,
      payload: { fill },
      physicsConfigVersion: PHYSICS_CONFIG_VERSION,
    },
  });
}

export async function recordTouchdown(
  flightId: string,
  learnerId: string,
  effectiveAt: Date,
): Promise<void> {
  await prisma.flightEvent.create({
    data: {
      flightId,
      learnerId,
      eventType: 'TOUCHDOWN',
      effectiveAt,
      payload: {},
      physicsConfigVersion: PHYSICS_CONFIG_VERSION,
    },
  });
}

export async function hasAward(learnerId: string, awardSlug: string): Promise<boolean> {
  const existing = await prisma.flightEvent.findFirst({
    where: { learnerId, eventType: 'AWARD_EARNED', payload: { path: ['awardSlug'], equals: awardSlug } },
    select: { id: true },
  });

  return existing !== null;
}

export async function recordAward(
  flightId: string,
  learnerId: string,
  effectiveAt: Date,
  awardSlug: string,
): Promise<void> {
  await prisma.flightEvent.create({
    data: {
      flightId,
      learnerId,
      eventType: 'AWARD_EARNED',
      effectiveAt,
      payload: { awardSlug },
      physicsConfigVersion: PHYSICS_CONFIG_VERSION,
    },
  });
}

export async function findEarnedAwards(
  learnerId: string,
): Promise<{ awardSlug: string; earnedAt: Date }[]> {
  const rows = await prisma.flightEvent.findMany({
    where: { learnerId, eventType: 'AWARD_EARNED' },
    select: { payload: true, effectiveAt: true },
  });

  return rows.map((row) => ({
    awardSlug: (row.payload as { awardSlug: string }).awardSlug,
    earnedAt: row.effectiveAt,
  }));
}
