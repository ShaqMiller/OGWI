/**
 * The single adaptive control/feedback hub for the ordinary (non-exam) Flow
 * (Doc 2 A2). Bundles the aid machinery that exam mode must never render:
 * Oggi, the litre counter, hints, listen, the Pomodoro chip.
 *
 * Deliberately imported ONLY by (flow)/layout.tsx. Exam mode
 * ((flow)/exam/[examId]/layout.tsx) has its own separate ExamShell
 * component tree that never imports this file - that's what makes "no aid
 * machinery in exam mode" structural rather than a prop/conditional that
 * could rot.
 */
export function DynamicIsland() {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <span title="Oggi">🐣 Oggi</span>
      <span title="Litre counter">0L</span>
      <button type="button">Hint</button>
      <button type="button">Listen</button>
      <button type="button">Pomodoro</button>
    </div>
  );
}
