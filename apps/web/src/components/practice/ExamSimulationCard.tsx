'use client';

import { useRouter } from 'next/navigation';
import { useStartExamRun } from '@/hooks/exam/useStartExamRun';
import { Button } from '@/components/ui/Button';

/**
 * Doc 2 A9's Exam Simulation: "one entry generating a fresh randomised paper
 * each time". A single button, not a list of papers - there is nothing to
 * browse, because every run is generated on demand.
 *
 * The question count and time aren't shown until the paper exists, because
 * both depend on how much exam-ready content the qualification actually has.
 */
export function ExamSimulationCard({
  qualificationSlug,
}: {
  qualificationSlug: string;
}) {
  const router = useRouter();
  const startRun = useStartExamRun();

  function start() {
    startRun.mutate(
      { qualificationSlug },
      { onSuccess: (run) => router.push(`/exam/${run.runId}`) },
    );
  }

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Exam Simulation</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 0 }}>
        A fresh randomised paper under exam conditions - no hints, no feedback until you
        finish.
      </p>
      <Button onClick={start} disabled={startRun.isPending}>
        {startRun.isPending ? 'Building your paper...' : 'Start an exam simulation'}
      </Button>
      {startRun.isError && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          There isn&apos;t enough exam-ready content here yet.
        </p>
      )}
    </div>
  );
}
