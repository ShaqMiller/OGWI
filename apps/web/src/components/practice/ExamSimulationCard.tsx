'use client';

import { useRouter } from 'next/navigation';
import type { StartableExamRunKind } from '@ogwi/shared';
import { useStartExamRun } from '@/hooks/exam/useStartExamRun';
import { Button } from '@/components/ui/Button';

/**
 * Doc 2 A9's exam-format entries: "one entry generating a fresh randomised
 * paper each time" - a button per kind, not a list of papers, because every
 * run is generated on demand.
 *
 * The mini-mock (10-20 questions, about 10 minutes, Doc 2 B2) is the short
 * option, and the one the readiness checklist asks for first. The real
 * question count and time aren't shown until the paper exists, because both
 * depend on how much exam-ready content the qualification actually has.
 */
export function ExamSimulationCard({
  qualificationSlug,
}: {
  qualificationSlug: string;
}) {
  const router = useRouter();
  const startRun = useStartExamRun();

  function start(kind: StartableExamRunKind) {
    startRun.mutate(
      { qualificationSlug, kind },
      { onSuccess: (run) => router.push(`/exam/${run.runId}`) },
    );
  }

  const starting = startRun.isPending ? startRun.variables?.kind : null;

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Exam practice</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 0 }}>
        A fresh randomised paper under exam conditions - no hints, no feedback until you finish.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button onClick={() => start('MINI_MOCK')} disabled={startRun.isPending}>
          {starting === 'MINI_MOCK' ? 'Building your paper...' : 'Mini-mock (about 10 minutes)'}
        </Button>
        <Button variant="secondary" onClick={() => start('SIMULATION')} disabled={startRun.isPending}>
          {starting === 'SIMULATION' ? 'Building your paper...' : 'Full exam simulation'}
        </Button>
      </div>
      {startRun.isError && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          There isn&apos;t enough exam-ready content here yet.
        </p>
      )}
    </div>
  );
}
