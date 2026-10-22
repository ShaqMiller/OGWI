'use client';

import Link from 'next/link';
import type { Qualification } from '@ogwi/shared';
import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { useFlightState } from '@/hooks/flight/useFlightState';
import { FlightSky, flightStatusLine } from '@/components/flight/FlightSky';
import { Card } from '@/components/ui/Card';

/**
 * Onboarding (Doc 2 A11): browse -> pick a qualification -> begin. A
 * light-touch visual pass, not a design - real design is coming from the
 * design team later; this exists so the backend pieces built so far are
 * clickable and presentable, not just curl-able.
 */
export default function HomePage() {
  const { data, isLoading, error } = useQualifications();

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Ogwi</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Pick a qualification to start (test content only - see CLAUDE.md).
      </p>
      {isLoading && <p>Loading qualifications...</p>}
      {error && <p>Could not reach the API yet (expected until it&apos;s running).</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {data?.map((q) => <QualificationTile key={q.id} qualification={q} />)}
      </div>
      {data?.length === 0 && <p>No qualifications seeded yet - run `pnpm db:seed`.</p>}
    </div>
  );
}

/** Its own component so each tile can read its own course's flight. */
function QualificationTile({ qualification }: { qualification: Qualification }) {
  const flight = useFlightState(qualification.slug);

  return (
    <Link href={`/qualifications/${qualification.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', height: '100%' }}>
        <FlightSky flight={flight.data} width={90} height={130} markers={[100]} showLabel={false} />
        <div style={{ minWidth: 0 }}>
          <strong>{qualification.name}</strong>
          {flight.data && (
            <div style={{ color: 'var(--color-balloon-light)', fontSize: '0.85rem', marginTop: 'var(--space-1)' }}>
              {flightStatusLine(flight.data)}
            </div>
          )}
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            Continue →
          </div>
        </div>
      </Card>
    </Link>
  );
}
