import { ExamResults } from '@/components/exam/ExamResults';

export default function ExamResultsPage({ params }: { params: { runId: string } }) {
  return <ExamResults runId={params.runId} />;
}
