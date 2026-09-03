import { ExamRunner } from '@/components/exam/ExamRunner';

export default function ExamPage({ params }: { params: { runId: string } }) {
  return <ExamRunner runId={params.runId} />;
}
