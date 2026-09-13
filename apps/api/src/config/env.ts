import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    // Lets demo learners (ids starting "demo-") move their clock forward, so
    // day-scale rules can be shown live - see lib/clock.ts. Parsed from the
    // literal string: z.coerce.boolean() would read "false" as true.
    TEST_CLOCK_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.TEST_CLOCK_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TEST_CLOCK_ENABLED'],
        message: 'The test clock must never be enabled in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
