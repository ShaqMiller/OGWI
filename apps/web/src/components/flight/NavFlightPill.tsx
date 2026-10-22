'use client';

import Link from 'next/link';
import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { useFlightStates } from '@/hooks/flight/useFlightStates';
import { Balloon } from './Balloon';
import { flightStatusLine, LIFTOFF_LITRES } from './FlightSky';

/**
 * The balloon in the nav, so the flight is on every page. It shows the
 * learner's highest flight across their courses - airborne beats grounded,
 * then the higher fill wins - and links to Progress, where each course's
 * full sky lives.
 */
export function NavFlightPill() {
  const qualifications = useQualifications();
  const flights = useFlightStates(qualifications.data?.map((q) => q.slug) ?? []);

  const best = flights
    .map((query) => query.data)
    .filter((flight) => flight !== undefined)
    .sort((a, b) => Number(b.isAirborne) - Number(a.isAirborne) || b.fill - a.fill)[0];

  if (!best) return null;

  return (
    <Link
      href="/progress"
      title="Your flight"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0.2rem 0.75rem 0.2rem 0.5rem',
        borderRadius: 999,
        background: 'var(--color-sky)',
        color: 'var(--color-text)',
        textDecoration: 'none',
        fontSize: '0.8rem',
      }}
    >
      <Balloon
        size={16}
        inflation={best.isAirborne ? 1 : 0.35 + 0.65 * Math.min(1, best.fill / LIFTOFF_LITRES)}
      />
      {flightStatusLine(best)}
    </Link>
  );
}
