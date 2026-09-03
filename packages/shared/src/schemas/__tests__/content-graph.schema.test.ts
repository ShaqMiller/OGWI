import { describe, expect, it } from 'vitest';
import { moduleSchema, qualificationSchema } from '../content-graph.schema.js';

describe('qualificationSchema', () => {
  it('accepts a well-formed qualification', () => {
    const result = qualificationSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'example-qualification',
      name: 'Example Qualification',
      contentGraphVersion: '2026-08-13.0',
      createdAt: new Date().toISOString(),
      passMark: 0.7,
    });

    expect(result.success).toBe(true);
  });
});

describe('moduleSchema', () => {
  it('rejects a blueprint weight outside 0-1', () => {
    const result = moduleSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000002',
      qualificationId: '00000000-0000-0000-0000-000000000001',
      name: 'Example Module',
      order: 0,
      blueprintWeight: 1.5,
    });

    expect(result.success).toBe(false);
  });
});
