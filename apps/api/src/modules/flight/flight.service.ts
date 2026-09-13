import { ALTITUDE_AWARD_CATALOG, ALTITUDE_CAP_FT, LIFTOFF_THRESHOLD_FT, type EarnedAward } from '@ogwi/shared';
import * as clock from '../../lib/clock.js';
import * as flightRepository from './flight.repository.js';
import { replayFlightState } from './flight-state.util.js';
import type { FlightState } from './flight.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Scope note: only a five-band slice of the altitude-firsts catalogue is
 * implemented (packages/shared/src/constants/awards.constants.ts) - proof
 * the award-earned mechanism works end to end, not the spec's full ~40-badge
 * catalogue (flight-length streaks, big days, comebacks, course tie-ins).
 * That's Awards-page content work, not physics. Longest-Flight/Highest-
 * Altitude historical records (across past, closed flights) also aren't
 * built yet - only the live/current flight's state and peak are tracked.
 */

/**
 * Checks every altitude-award threshold this pump crossed (from the
 * pre-pump fill to the new fill) and records any not already earned.
 * Awards are learner-global (the DB's partial unique index is keyed on
 * learnerId alone, not learnerId+qualificationId) - a learner only ever
 * earns "First Lift" once, regardless of which qualification's flight
 * crosses it first.
 */
async function checkAltitudeAwards(
  flightId: string,
  learnerId: string,
  previousFill: number,
  newFill: number,
  now: Date,
): Promise<void> {
  for (const award of ALTITUDE_AWARD_CATALOG) {
    if (previousFill < award.thresholdFt && newFill >= award.thresholdFt) {
      const alreadyEarned = await flightRepository.hasAward(learnerId, award.slug);
      if (!alreadyEarned) {
        await flightRepository.recordAward(flightId, learnerId, now, award.slug);
      }
    }
  }
}

export async function getFlightState(
  learnerId: string,
  qualificationId: string,
): Promise<FlightState> {
  const flightId = await flightRepository.findOpenFlightId(learnerId, qualificationId);

  if (!flightId) {
    return { flightId: null, fill: 0, isAirborne: false, peak: 0, liftoffAt: null, justTouchedDown: false };
  }

  const now = clock.now();
  const pumps = await flightRepository.findPumpEvents(flightId);
  const replayed = replayFlightState(pumps, now);

  // Touchdown is materialised at first discovery, by any read or write
  // (Doc 2 B9) - the moment a replay finds an airborne flight has drained
  // to 0, this closes it so the next pump correctly starts a new flight.
  if (replayed.isAirborne && replayed.fill <= 0) {
    await flightRepository.recordTouchdown(flightId, learnerId, now);
    return {
      flightId,
      fill: 0,
      isAirborne: false,
      peak: replayed.peak,
      liftoffAt: replayed.liftoffAt,
      justTouchedDown: true,
    };
  }

  return {
    flightId,
    fill: replayed.fill,
    isAirborne: replayed.isAirborne,
    peak: replayed.peak,
    liftoffAt: replayed.liftoffAt,
    justTouchedDown: false,
  };
}

export async function pump(
  learnerId: string,
  qualificationId: string,
  amount: number,
  idempotencyKey: string,
): Promise<FlightState> {
  if (amount <= 0) {
    // Litres never subtract, and a zero-value pump changes nothing.
    return getFlightState(learnerId, qualificationId);
  }

  // Already pumped for this act. Checked before createFlight so a retry can
  // never leave a stray empty flight behind; recordPump's unique-violation
  // catch handles the genuinely concurrent case below.
  if (await flightRepository.findPumpEventByKey(idempotencyKey)) {
    return getFlightState(learnerId, qualificationId);
  }

  const now = clock.now();
  let state = await getFlightState(learnerId, qualificationId);

  let flightId = state.flightId;
  if (!flightId || state.justTouchedDown) {
    flightId = await flightRepository.createFlight(learnerId, qualificationId, now);
    state = { flightId, fill: 0, isAirborne: false, peak: 0, liftoffAt: null, justTouchedDown: false };
  }

  const newFill = Math.min(ALTITUDE_CAP_FT, state.fill + amount);
  const recorded = await flightRepository.recordPump(flightId, learnerId, amount, now, idempotencyKey);

  // Lost a race with an identical pump; the winner's state is the truth.
  if (!recorded) return getFlightState(learnerId, qualificationId);

  let liftoffAt = state.liftoffAt;
  const crossedLiftoff = !state.isAirborne && newFill >= LIFTOFF_THRESHOLD_FT;

  if (crossedLiftoff) {
    liftoffAt = now;
    await flightRepository.recordLiftoff(flightId, learnerId, now, newFill);
  }

  await checkAltitudeAwards(flightId, learnerId, state.fill, newFill, now);

  return {
    flightId,
    fill: newFill,
    isAirborne: state.isAirborne || crossedLiftoff,
    peak: Math.max(state.peak, newFill),
    liftoffAt,
    justTouchedDown: false,
  };
}

export async function getAwards(learnerId: string): Promise<EarnedAward[]> {
  const earned = await flightRepository.findEarnedAwards(learnerId);
  const earnedAtBySlug = new Map(earned.map((row) => [row.awardSlug, row.earnedAt]));

  return ALTITUDE_AWARD_CATALOG.map((award) => ({
    slug: award.slug,
    name: award.name,
    thresholdFt: award.thresholdFt,
    earnedAt: earnedAtBySlug.get(award.slug) ?? null,
  }));
}
