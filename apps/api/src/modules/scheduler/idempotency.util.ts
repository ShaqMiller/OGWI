/**
 * Idempotency keys for the grading write path.
 *
 * One learning act writes one ReviewEvent, one LitreEvent and (via the
 * economy) one flight pump. All three derive from a single act key, so a
 * retried request lands on the same unique constraints and writes nothing new.
 *
 * Format: `<namespace>:<actId>[:<subsystem>]`. Deliberately readable rather
 * than hashed - an append-only log is worth far more when you can grep it and
 * see which act a row belongs to.
 *
 * These keys do NOT restrict repetition. Answering the same item again with a
 * new attemptId produces a different act key and is graded and paid normally,
 * which is what Doc 2 B8 requires ("no locks anywhere"; re-grinding a not-due
 * item pays 1L and that is "the only anti-farm mechanism").
 */

/**
 * A practice answer. Scoped by learner because LitreEvent.idempotencyKey is
 * GLOBALLY unique - an unprefixed client-supplied uuid would let one learner
 * consume a key another learner still needed.
 */
export function reviewActKey(learnerId: string, attemptId: string): string {
  return `review:${learnerId}:${attemptId}`;
}

/**
 * One question of an exam run. No client input needed: ExamRunItem.id is
 * already unique per served question, and claimForGrading already guarantees
 * at-most-once. The key makes the litre and pump rows carry a real derived id
 * rather than a random one.
 */
export function examItemActKey(examRunItemId: string): string {
  return `exam-item:${examRunItemId}`;
}

/** The litre event paid for an act. */
export function litreKey(actKey: string): string {
  return `${actKey}:litre`;
}

/** The flight pump fed by an act's litres. */
export function pumpKey(actKey: string): string {
  return `${actKey}:pump`;
}

/**
 * The completion premium for a whole run. Keyed on the RUN, not a batch:
 * unlike the per-question grading, the premium is paid once for the finished
 * paper however many times submit is retried or resumed.
 */
export function examRunPremiumKey(examRunId: string): string {
  return `exam-run:${examRunId}:premium`;
}
