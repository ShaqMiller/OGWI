import { DEMO_LEARNER_PREFIX } from '@ogwi/shared';

/**
 * Which learner the app acts as, while the test clock is enabled.
 *
 * The /dev page switches to a demo learner by setting this cookie, and the BFF
 * proxy honours it. Only ids starting with DEMO_LEARNER_PREFIX are ever
 * accepted, so the cookie can switch INTO a throwaway learner but can never
 * select a real learner's data. Dev tooling only - real auth replaces all of it.
 */

export const DEV_LEARNER_COOKIE = 'ogwi-dev-learner';

/** Server side: the cookie's learner, or null unless it names a demo learner. */
export function demoLearnerFromCookie(value: string | undefined): string | null {
  return value && value.startsWith(DEMO_LEARNER_PREFIX) ? value : null;
}

/** Browser side. */
export function readDevLearnerCookie(): string | null {
  if (typeof document === 'undefined') return null;

  const pair = document.cookie.split('; ').find((part) => part.startsWith(`${DEV_LEARNER_COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(DEV_LEARNER_COOKIE.length + 1)) : null;
}

/** Browser side. Pass null to go back to the default learner. */
export function writeDevLearnerCookie(learnerId: string | null): void {
  document.cookie = learnerId
    ? `${DEV_LEARNER_COOKIE}=${encodeURIComponent(learnerId)}; path=/; SameSite=Lax`
    : `${DEV_LEARNER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
