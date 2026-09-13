import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Several suites here are integration tests against a real local Postgres
 * seeded with the demo content (see prisma/seed.ts) - vitest doesn't read
 * .env files on its own, so load .env.test explicitly. Copy
 * .env.test.example to .env.test if your Postgres credentials differ from
 * the docker-compose defaults, then run `pnpm run db:test:setup`.
 */
const envTestPath = fileURLToPath(new URL('.env.test', import.meta.url));
if (existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      // The dev routes are exercised over HTTP; the flag-off case builds its
      // own app with createApp({ testClockEnabled: false }).
      TEST_CLOCK_ENABLED: 'true',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://ogwi:ogwi@localhost:5432/ogwi_test',
    },
  },
});
