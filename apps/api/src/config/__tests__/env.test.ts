import { describe, expect, it } from 'vitest';
import { parseEnv } from '../env.js';

const base = { DATABASE_URL: 'postgresql://example' };

describe('parseEnv', () => {
  it('leaves the test clock off unless explicitly enabled', () => {
    expect(parseEnv({ ...base }).TEST_CLOCK_ENABLED).toBe(false);
    expect(parseEnv({ ...base, TEST_CLOCK_ENABLED: 'false' }).TEST_CLOCK_ENABLED).toBe(false);
    expect(parseEnv({ ...base, TEST_CLOCK_ENABLED: 'true' }).TEST_CLOCK_ENABLED).toBe(true);
  });

  it('rejects anything but the literal strings, rather than guessing', () => {
    expect(() => parseEnv({ ...base, TEST_CLOCK_ENABLED: '1' })).toThrow();
  });

  it('refuses to boot with the test clock enabled in production', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', TEST_CLOCK_ENABLED: 'true' }),
    ).toThrow(/never be enabled in production/);
    expect(parseEnv({ ...base, NODE_ENV: 'production' }).TEST_CLOCK_ENABLED).toBe(false);
  });
});
