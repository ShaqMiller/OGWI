import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * GET /api/content-graph/knowledge-items/:id is unauthenticated ("browsing
 * is pre-auth", see content-graph.routes.ts). It used to return the
 * rendering's correctOptionIndex, which made every answer key publicly
 * readable for any item id.
 *
 * This asserts at the HTTP layer on purpose: a service-level check can pass
 * while a controller or serializer change puts the field back on the wire.
 */

let knowledgeItemId: string;

beforeAll(async () => {
  const qualification = await prisma.qualification.findUniqueOrThrow({
    where: { slug: 'demo-cert' },
  });

  const item = await prisma.knowledgeItem.findFirstOrThrow({
    where: { objective: { topic: { module: { qualificationId: qualification.id } } } },
    select: { id: true },
  });

  knowledgeItemId = item.id;
});

describe('GET /api/content-graph/knowledge-items/:id', () => {
  it('serves the question without leaking the answer key', async () => {
    const app = createApp();

    const res = await request(app).get(`/api/content-graph/knowledge-items/${knowledgeItemId}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).not.toContain('correctOptionIndex');
    expect(res.body.prompt).toBeTruthy();
    expect(res.body.options.length).toBeGreaterThan(1);
  });

  it('returns the renderingId the learner must answer against', async () => {
    const app = createApp();

    const res = await request(app).get(`/api/content-graph/knowledge-items/${knowledgeItemId}`);

    expect(res.status).toBe(200);
    expect(res.body.renderingId).toEqual(expect.any(String));
    expect(res.body.format).toBe('MULTIPLE_CHOICE');
  });

  it('404s for a knowledge item that has no rendering', async () => {
    const app = createApp();

    const res = await request(app).get(
      '/api/content-graph/knowledge-items/00000000-0000-0000-0000-000000000000',
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
