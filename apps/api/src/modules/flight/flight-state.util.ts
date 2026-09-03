import { ALTITUDE_CAP_FT, LIFTOFF_THRESHOLD_FT } from '@ogwi/shared';
import { evaluateFill } from './physics.util.js';
import type { PumpEventRecord } from './flight.types.js';

export interface ReplayedFlightState {
  fill: number;
  peak: number;
  liftoffAt: Date | null;
  isAirborne: boolean;
}

/**
 * Replays a flight's pump history into a current state. Grounded fill
 * accumulates leak-free (Doc 2 B9); once a pump crosses the liftoff
 * threshold, every later gap - between pumps, and from the last pump to
 * `now` - decays via the physics evaluator. Peak only needs checking at
 * pump instants ("between pumps altitude only falls").
 */
export function replayFlightState(pumps: PumpEventRecord[], now: Date): ReplayedFlightState {
  let fill = 0;
  let peak = 0;
  let liftoffAt: Date | null = null;
  let isAirborne = false;
  let lastEventAt: Date | null = null;

  for (const pump of pumps) {
    if (isAirborne && lastEventAt) {
      fill = evaluateFill(fill, lastEventAt, pump.effectiveAt);
    }

    fill = Math.min(ALTITUDE_CAP_FT, fill + pump.amount);
    peak = Math.max(peak, fill);

    if (!isAirborne && fill >= LIFTOFF_THRESHOLD_FT) {
      isAirborne = true;
      liftoffAt = pump.effectiveAt;
    }

    lastEventAt = pump.effectiveAt;
  }

  if (isAirborne && lastEventAt) {
    fill = evaluateFill(fill, lastEventAt, now);
  }

  return { fill, peak, liftoffAt, isAirborne };
}
