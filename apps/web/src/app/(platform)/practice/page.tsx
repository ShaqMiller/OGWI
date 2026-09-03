'use client';

import { useQualifications } from '@/hooks/content-graph/useQualifications';
import { QualificationPracticeSection } from '@/components/practice/QualificationPracticeSection';

/**
 * Doc 2 A9's Practice page has six sections. Only "Recommended" is backed
 * by real, working endpoints right now (the scheduler's due items, the
 * adaptive engine's wrong-answer pool) - see docs/BUILD_ORDER.md step 7.
 * Exam Simulation is now real too (docs/BUILD_ORDER.md step 12). The rest
 * (Jump back in, Create a test, Activities, Completed) need systems that
 * don't exist yet and aren't faked here.
 */
export default function PracticePage() {
  const { data, isLoading, error } = useQualifications();

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Practice</h1>

      {isLoading && <p>Loading...</p>}
      {error && <p>Could not reach the API.</p>}
      {data?.length === 0 && <p>No qualifications yet - run `pnpm db:seed`.</p>}
      {data?.map((qualification) => (
        <QualificationPracticeSection key={qualification.id} qualification={qualification} />
      ))}

      <p style={{ marginTop: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        Not built yet: jump back into a paused quiz, building a custom test, and a history of
        completed attempts. Exams have no timer, flagging or question-navigation panel yet
        either. Blurt and Teach Oggi are available from a qualification&apos;s page.
      </p>
    </div>
  );
}
