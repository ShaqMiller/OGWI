'use client';

import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { QualificationProgressCard } from '@/components/progress/QualificationProgressCard';

/**
 * Doc 2 A10's Progress page, trimmed to what actually exists: per
 * qualification, mastery per module, points, altitude, the coverage forecast,
 * and the odds of passing (or the checklist that unlocks them).
 */
export default function ProgressPage() {
  const { data, isLoading, error } = useQualifications();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Progress</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Points and altitude move as you go. Mastery and your odds of passing update when you
        finish a session.
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
