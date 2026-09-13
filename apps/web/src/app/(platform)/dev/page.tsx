import { notFound } from 'next/navigation';
import { DevPanel } from '@/components/dev/DevPanel';

// Read the flag at request time, never baked in at build.
export const dynamic = 'force-dynamic';

/**
 * Dev tools: the test clock and what it moves. Exists only while
 * TEST_CLOCK_ENABLED is on - otherwise this is an ordinary 404.
 */
export default function DevPage() {
  if (process.env.TEST_CLOCK_ENABLED !== 'true') notFound();

  return <DevPanel defaultLearnerId={process.env.DEV_LEARNER_ID ?? 'dev-learner-1'} />;
}
