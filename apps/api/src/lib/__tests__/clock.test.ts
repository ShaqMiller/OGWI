import { afterEach, describe, expect, it, vi } from 'vitest';
import { now, runWithOffset } from '../clock.js';

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe('clock', () => {
  it('is the real time outside any offset', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));

    expect(now().toISOString()).toBe('2026-09-13T12:00:00.000Z');
  });

  it('applies the offset inside runWithOffset, including after an await', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));

    const seen = await runWithOffset(2 * DAY_MS, async () => {
      const before = now().toISOString();
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
      return { before, after: now().toISOString() };
    });

    expect(seen).toEqual({
      before: '2026-09-15T12:00:00.000Z',
      after: '2026-09-15T12:00:00.000Z',
    });
    // And it does not leak out.
    expect(now().toISOString()).toBe('2026-09-13T12:00:00.000Z');
  });

  it('keeps concurrent offsets apart', async () => {
    const read = (offsetMs: number) =>
      runWithOffset(offsetMs, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return now().getTime() - Date.now();
      });

    const [a, b] = await Promise.all([read(DAY_MS), read(3 * DAY_MS)]);

    expect(Math.round(a / DAY_MS)).toBe(1);
    expect(Math.round(b / DAY_MS)).toBe(3);
  });
});
