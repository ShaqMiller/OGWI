import { prisma } from '../../lib/prisma.js';

/**
 * The only file in this module allowed to import the Prisma client.
 */

export async function findOffsetSeconds(learnerId: string): Promise<number> {
  const row = await prisma.learnerClockOffset.findUnique({
    where: { learnerId },
    select: { offsetSeconds: true },
  });

  return row?.offsetSeconds ?? 0;
}

/** Moves the clock forward by `seconds` and returns the new total. Atomic, so two quick clicks both count. */
export async function addOffsetSeconds(learnerId: string, seconds: number): Promise<number> {
  const row = await prisma.learnerClockOffset.upsert({
    where: { learnerId },
    create: { learnerId, offsetSeconds: seconds },
    update: { offsetSeconds: { increment: seconds } },
    select: { offsetSeconds: true },
  });

  return row.offsetSeconds;
}

/**
 * Deletes everything a learner has written, and their clock offset, in one
 * transaction.
 *
 * This deliberately breaks the append-only rule for the event logs, and is
 * only reachable for demo learners behind TEST_CLOCK_ENABLED. It is the only
 * way to bring a demo learner back to real time: rewinding the offset instead
 * would leave rows stamped in a future the clock had just left.
 */
export async function deleteLearnerData(learnerId: string): Promise<Record<string, number>> {
  return prisma.$transaction(async (tx) => {
    const flightEvents = await tx.flightEvent.deleteMany({ where: { learnerId } });
    const flights = await tx.flight.deleteMany({ where: { learnerId } });
    const litreEvents = await tx.litreEvent.deleteMany({ where: { learnerId } });
    const reviewEvents = await tx.reviewEvent.deleteMany({ where: { learnerId } });
    const itemMemoryStates = await tx.itemMemoryState.deleteMany({ where: { learnerId } });
    const publishedMastery = await tx.publishedMastery.deleteMany({ where: { learnerId } });
    // Exam run items go with their run (onDelete: Cascade).
    const examRuns = await tx.examRun.deleteMany({ where: { learnerId } });
    const clockOffsets = await tx.learnerClockOffset.deleteMany({ where: { learnerId } });

    return {
      flightEvents: flightEvents.count,
      flights: flights.count,
      litreEvents: litreEvents.count,
      reviewEvents: reviewEvents.count,
      itemMemoryStates: itemMemoryStates.count,
      publishedMastery: publishedMastery.count,
      examRuns: examRuns.count,
      clockOffsets: clockOffsets.count,
    };
  });
}
