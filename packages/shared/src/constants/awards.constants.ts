/**
 * A small slice of Doc 2 A14's altitude-firsts catalogue - real names from
 * the spec, not the full ~11-band list (First Lift through The Ceiling,
 * plus Orbit). The rest of the catalogue (flight-length streaks, big days,
 * lifetime totals, sustained-altitude awards, comebacks, course tie-ins -
 * ~40 more) is not built. Awards are learner-global, not per-qualification
 * (matches the existing DB constraint from the flight-physics build:
 * one award per learner, not one per learner per qualification).
 */
export interface AltitudeAwardDefinition {
  slug: string;
  name: string;
  thresholdFt: number;
}

export const ALTITUDE_AWARD_CATALOG: AltitudeAwardDefinition[] = [
  { slug: 'first_lift', name: 'First Lift', thresholdFt: 100 },
  { slug: 'above_the_rooftops', name: 'Above the Rooftops', thresholdFt: 200 },
  { slug: 'high_rise_view', name: 'High-rise View', thresholdFt: 300 },
  { slug: 'breaking_the_skyline', name: 'Breaking the Skyline', thresholdFt: 500 },
  { slug: 'the_ceiling', name: 'The Ceiling', thresholdFt: 1000 },
];
