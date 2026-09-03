import { PHYSICS_CONFIG_VERSION } from '@ogwi/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { PumpEventRecord } from './flight.types.js';

/**
 * The only file in this module allowed to import the Prisma client - and so
 * the only layer allowed to know what a Prisma error code is.
 */

/**
 * True when a write lost a race to a unique constraint.
 *
 * Several writes here are "materialise once, at first discovery" (touchdown,
 * awards) or retry-safe by key (pumps). Their real guarantee is a unique
 * index, and the reads that guard them are only fast paths - so losing the
 * race is an expected outcome, not an error. Before this, a concurrent loser
 * threw a raw P2002 that nothing caught: two dashboard loads at the exact
 * moment a flight drained to zero would 500.
 */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

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

/**
 * Records a pump. Returns false when this pump was already recorded.
 *
 * `idempotencyKey` is derived from the learning act that earned the litres,
 * not a randomUUID() - the old key was unique on every call and so could
 * never fire, making schema.prisma's "pumps are idempotent" claim untrue.
 */
export async function recordPump(
  flightId: string,
  learnerId: string,
  amount: number,
  effectiveAt: Date,
  idempotencyKey: string,
): Promise<boolean> {
  try {
    await prisma.flightEvent.create({
      data: {
        flightId,
        learnerId,
        eventType: 'PUMP',
        effectiveAt,
        payload: { amount },
        idempotencyKey,
        physicsConfigVersion: PHYSICS_CONFIG_VERSION,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/** Fast path for the common sequential retry, before any flight is created. */
export async function findPumpEventByKey(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.flightEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });

  return existing !== null;
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

/**
 * Materialises a touchdown, at most once per flight (partial unique index).
 * Reachable from a READ - getFlightState discovers it - and therefore from
 * GET /api/flight/state, so two concurrent dashboard loads can race here.
 */
export async function recordTouchdown(
  flightId: string,
  learnerId: string,
  effectiveAt: Date,
): Promise<void> {
  try {
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
  } catch (error) {
    // Another request materialised it first; that is the correct outcome.
    if (!isUniqueViolation(error)) throw error;
  }
}

export async function hasAward(learnerId: string, awardSlug: string): Promise<boolean> {
  const existing = await prisma.flightEvent.findFirst({
    where: { learnerId, eventType: 'AWARD_EARNED', payload: { path: ['awardSlug'], equals: awardSlug } },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Awards once per learner per award (partial unique index on the payload's
 * awardSlug). hasAward above is only a fast path - the index is the guarantee,
 * and this catch is what makes the TOCTOU between them harmless.
 */
export async function recordAward(
  flightId: string,
  learnerId: string,
  effectiveAt: Date,
  awardSlug: string,
): Promise<void> {
  try {
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
  } catch (error) {
    // Already earned - awards are once-ever per learner.
    if (!isUniqueViolation(error)) throw error;
  }
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
