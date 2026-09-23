import { describe, expect, it } from 'vitest';
import { weekContaining } from '../week.util.js';

describe('weekContaining', () => {
  it('runs Monday to Sunday in UTC', () => {
    // 2026-09-23 is a Wednesday.
    const week = weekContaining(new Date('2026-09-23T14:30:00Z'));

    expect(week.start.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(week.end.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(week.days).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('keeps Sunday in the week that started the Monday before', () => {
    const week = weekContaining(new Date('2026-09-27T23:59:59Z'));

    expect(week.start.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('starts a new week on Monday itself', () => {
    const week = weekContaining(new Date('2026-09-28T00:00:00Z'));

    expect(week.start.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('steps back a whole week at a time', () => {
    const lastWeek = weekContaining(new Date('2026-09-23T14:30:00Z'), 1);

    expect(lastWeek.start.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(lastWeek.end.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });
});
