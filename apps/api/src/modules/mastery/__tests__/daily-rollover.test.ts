import { describe, expect, it } from 'vitest';
import { isDailyRolloverDue } from '../mastery.service.js';

const at = (iso: string) => new Date(iso);
const now = at('2026-09-15T12:00:00Z');

describe('isDailyRolloverDue', () => {
  it('is not due when there is nothing to publish', () => {
    expect(isDailyRolloverDue({ lastPublishedAt: null, lastReviewedAt: null, now })).toBe(false);
  });

  it('is due on a new UTC day once the learner has been idle', () => {
    expect(
      isDailyRolloverDue({
        lastPublishedAt: at('2026-09-14T09:00:00Z'),
        lastReviewedAt: at('2026-09-15T11:29:00Z'),
        now,
      }),
    ).toBe(true);
  });

  it('never fires within 30 minutes of an answer, even on a new day', () => {
    expect(
      isDailyRolloverDue({
        lastPublishedAt: at('2026-09-14T09:00:00Z'),
        lastReviewedAt: at('2026-09-15T11:31:00Z'),
        now,
      }),
    ).toBe(false);
  });

  it('fires once a day: not again after a publish since midnight', () => {
    expect(
      isDailyRolloverDue({
        lastPublishedAt: at('2026-09-15T00:05:00Z'),
        lastReviewedAt: at('2026-09-14T20:00:00Z'),
        now,
      }),
    ).toBe(false);
  });

  it('counts days in UTC', () => {
    expect(
      isDailyRolloverDue({
        lastPublishedAt: at('2026-09-14T23:59:00Z'),
        lastReviewedAt: at('2026-09-14T22:00:00Z'),
        now: at('2026-09-15T00:01:00Z'),
      }),
    ).toBe(true);
  });

  it('publishes a learner who has never been published, once idle', () => {
    expect(
      isDailyRolloverDue({ lastPublishedAt: null, lastReviewedAt: at('2026-09-15T11:00:00Z'), now }),
    ).toBe(true);
  });
});
