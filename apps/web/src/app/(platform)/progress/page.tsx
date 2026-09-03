'use client';

import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { QualificationProgressCard } from '@/components/progress/QualificationProgressCard';

/**
 * Doc 2 A10's Progress page, trimmed to what actually exists: mastery per
 * module and points, per qualification. Not built: completion % / expected
 * finish date (needs the forecast piece of readiness, step 9) and the
 * readiness/"odds of passing" headline (step 9 also) - both still open
 * build-order items, not faked here.
 */
export default function ProgressPage() {
  const { data, isLoading, error } = useQualifications();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Progress</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Mastery, points, altitude, and odds of passing - all live.
      </p>

      {isLoading && <p>Loading...</p>}
      {error && <p>Could not reach the API.</p>}
      {data?.length === 0 && <p>No qualifications yet - run `pnpm db:seed`.</p>}
      {data?.map((qualification) => (
        <QualificationProgressCard key={qualification.id} qualification={qualification} />
      ))}
    </div>
  );
}
