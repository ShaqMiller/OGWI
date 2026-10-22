import type { FlightStateResponse } from '@ogwi/shared';
import { Balloon } from './Balloon';

/** Litres needed to leave the ground (Doc 2 B9). */
export const LIFTOFF_LITRES = 100;

/** The top of the panel. Higher flights pin to the top rather than leave it. */
const SKY_CEILING_FT = 600;
const GROUND_HEIGHT = 18;
const TOP_PADDING = 14;
const DEFAULT_MARKERS = [100, 200, 500];

/**
 * Altitude -> distance above the ground, on a square-root scale so the first
 * hundred feet - where every learner starts - gets real room, while 500ft
 * still fits in the same panel.
 */
function liftPx(altitudeFt: number, skyHeight: number): number {
  const usable = skyHeight - GROUND_HEIGHT - TOP_PADDING;
  return usable * Math.sqrt(Math.min(altitudeFt, SKY_CEILING_FT) / SKY_CEILING_FT);
}

/**
 * The flight as a sky: a balloon that inflates on the ground as litres come
 * in, lifts off at 100L, and rises and drifts with the live altitude. Purely
 * a view of `GET /api/flight/state` - it computes nothing the physics layer
 * doesn't already own.
 */
export function FlightSky({
  flight,
  width = 150,
  height = 230,
  markers = DEFAULT_MARKERS,
  earnedMarkers,
  showLabel = true,
}: {
  flight: Pick<FlightStateResponse, 'fill' | 'isAirborne'> | undefined;
  width?: number | string;
  height?: number;
  markers?: number[];
  /** Thresholds to draw as reached (the Awards page lights its earned bands). */
  earnedMarkers?: number[];
  /** Compact tiles that print the status beside the sky can drop the in-sky chip. */
  showLabel?: boolean;
}) {
  const fill = flight?.fill ?? 0;
  const airborne = flight?.isAirborne ?? false;
  const inflation = airborne ? 1 : Math.min(1, fill / LIFTOFF_LITRES);
  const balloonSize = 44;
  const balloonBottom = GROUND_HEIGHT + (airborne ? liftPx(fill, height) : 0);
  const label = !flight
    ? '...'
    : airborne
      ? `${Math.round(fill)}ft`
      : `${Math.round(fill)}L / ${LIFTOFF_LITRES}`;

  return (
    <div
      role="img"
      aria-label={
        airborne
          ? `Your balloon is flying at ${Math.round(fill)} feet`
          : `Your balloon is on the ground, ${Math.round(fill)} of ${LIFTOFF_LITRES} litres to liftoff`
      }
      style={{
        position: 'relative',
        width,
        height,
        flexShrink: 0,
        background: 'var(--color-sky)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {markers.map((ft) => {
        const reached = earnedMarkers?.includes(ft);
        const bottom = GROUND_HEIGHT + liftPx(ft, height);
        return (
          <div key={ft}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom,
                borderTop: `1px dashed ${reached ? 'var(--color-balloon)' : 'var(--color-sky-line)'}`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 8,
                bottom: bottom + 2,
                fontSize: '0.68rem',
                color: reached ? 'var(--color-balloon-light)' : 'var(--color-text-muted)',
              }}
            >
              {ft}ft
            </span>
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: balloonBottom,
          transform: 'translateX(-50%)',
          transition: 'bottom 0.8s ease',
        }}
      >
        <Balloon size={balloonSize} inflation={0.35 + 0.65 * inflation} />
      </div>

      {showLabel && (
        <span
          style={{
            position: 'absolute',
            right: 8,
            bottom: Math.min(balloonBottom + balloonSize * 1.4, height - 24),
            transition: 'bottom 0.8s ease',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-on-cta)',
            background: 'var(--color-balloon-light)',
            padding: '1px 7px',
            borderRadius: 8,
          }}
        >
          {label}
        </span>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: GROUND_HEIGHT,
          background: 'var(--color-ground)',
        }}
      />
    </div>
  );
}

/** One line of words for the same state, for beside the sky. */
export function flightStatusLine(flight: Pick<FlightStateResponse, 'fill' | 'isAirborne'>): string {
  if (flight.isAirborne) return `Flying at ${Math.round(flight.fill)}ft`;
  const toGo = Math.max(0, Math.ceil(LIFTOFF_LITRES - flight.fill));
  return `${toGo}L to liftoff`;
}
