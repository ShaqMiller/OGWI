import { ExamShell } from '@/components/exam/ExamShell';

/**
 * Exam mode is a structurally separate route group from (flow), not a
 * nested route inside it. If it nested under (flow)/layout.tsx, that
 * layout's DynamicIsland (Oggi, litre counter, hints, listen, Pomodoro)
 * would still render around it - a conditional deep inside a shared
 * component, exactly what the handover warns rots over time. Being a
 * sibling group means this file's import list is the only thing that can
 * ever put aid machinery in exam mode, and it doesn't.
 */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <ExamShell>{children}</ExamShell>;
}
