import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every business time read must go through lib/clock.ts, or the test clock
 * silently stops applying to it: a demo learner would advance two days and one
 * rule would still think it was today. This makes a missed call site loud.
 *
 * Only reads of the CURRENT time are flagged. `new Date(someValue)` is
 * arithmetic on a time already obtained, and stays allowed.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const ALLOWED = new Set(['lib/clock.ts']);
const CURRENT_TIME_READ = /new Date\(\s*\)|Date\.now\(\s*\)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('clock guard', () => {
  it('reads the current time only through lib/clock.ts', () => {
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const name = relative(SRC, file).split(sep).join('/');
      if (ALLOWED.has(name)) return [];

      return readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => !line.startsWith('*') && !line.startsWith('//'))
        .filter(({ line }) => CURRENT_TIME_READ.test(line))
        .map(({ line, number }) => `${name}:${number}  ${line}`);
    });

    expect(offenders).toEqual([]);
  });
});
