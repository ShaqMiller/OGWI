import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The one place business logic reads the time.
 *
 * Every rule that depends on time - due dates, remediation's two-different-days
 * exit, mastery easing, flight decay, readiness windows - calls now() instead
 * of `new Date()`. That is what lets the test clock move a demo learner
 * forward in time: the offset is resolved once per request (see
 * middleware/learnerClock.ts) and applies to every read inside it.
 *
 * Outside a request - tests calling services directly, scripts - the offset is
 * 0, so now() is the real time and vi.setSystemTime keeps working.
 *
 * Nothing here imports Prisma; the offset is looked up by the middleware and
 * handed in. clock-guard.test.ts fails if a `new Date()` or `Date.now()`
 * appears anywhere else in src.
 */

const offsetStore = new AsyncLocalStorage<{ offsetMs: number }>();

export function now(): Date {
  const offsetMs = offsetStore.getStore()?.offsetMs ?? 0;
  return new Date(Date.now() + offsetMs);
}

/** Runs `fn` - and everything it awaits - with the clock shifted forward by `offsetMs`. */
export function runWithOffset<T>(offsetMs: number, fn: () => T): T {
  return offsetStore.run({ offsetMs }, fn);
}
