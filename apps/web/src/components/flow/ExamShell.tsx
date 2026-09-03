/**
 * Exam mode's own chrome - the strictest face of the Flow (Doc 2 A2 / A5).
 * Exam controls only: timer, back/next, question navigation, flag. This
 * file must never import DynamicIsland or anything from it (Oggi, litre
 * counter, hints, listen, Pomodoro) - invariant 10 in the handover's
 * philosophy is enforced by this file's import list, not by a runtime
 * check.
 */
export function ExamShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #ddd',
        }}
      >
        <span>Pause</span>
        <span>Question 1 of N</span>
        <span>Flag</span>
      </header>
      <main style={{ padding: '1rem' }}>{children}</main>
      <footer style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
        <button type="button">Back</button>
        <button type="button">Next</button>
      </footer>
    </div>
  );
}
