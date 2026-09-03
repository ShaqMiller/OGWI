'use client';

import Link from 'next/link';
import { useQualifications } from '@/hooks/content-graph/useQualifications';
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
    <div style={{ maxWidth: 640 }}>
      <h1>Ogwi</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Pick a qualification to start (test content only - see CLAUDE.md).
      </p>
      {isLoading && <p>Loading qualifications...</p>}
      {error && <p>Could not reach the API yet (expected until it&apos;s running).</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {data?.map((q) => (
          <Link key={q.id} href={`/qualifications/${q.slug}`} style={{ textDecoration: 'none' }}>
            <Card>
              <strong>{q.name}</strong>
            </Card>
          </Link>
        ))}
        {data?.length === 0 && <p>No qualifications seeded yet - run `pnpm db:seed`.</p>}
      </div>
    </div>
  );
}
