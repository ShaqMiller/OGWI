/**
 * Exam mode's own chrome - the strictest face of the Flow (Doc 2 A2 / A5).
 *
 * This file must never import DynamicIsland or anything from it (Oggi, litre
 * counter, hints, listen, Pomodoro). Invariant 10 - "exam mode contains no
 * aid machinery" - is enforced by this file's import list, not by a runtime
 * check, and it now lives in components/exam/ so the boundary is a directory
 * boundary too.
 *
 * Deliberately just the frame. It used to hardcode a header ("Pause /
 * Question 1 of N / Flag") and Back/Next buttons, but this renders from a
 * layout, which has no access to run state - those controls belong to the
 * page that owns the run.
 */
export function ExamShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4) var(--space-3)' }}>
        {children}
      </main>
    </div>
  );
}
