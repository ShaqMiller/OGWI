import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

/**
 * Regression coverage for a real bug: Express 4 doesn't forward an error
 * thrown inside an `async` route handler to the error middleware on its
 * own - it crashes the process instead. `express-async-errors` (imported
 * at the top of app.ts) patches this. Every case here would previously
 * have hung/crashed the server instead of returning a response.
 */
describe('errors from async route handlers reach the error middleware', () => {
  it('returns 400 (not a crash) for a validation error thrown inside an async handler', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/scheduler/reviews')
      .set('x-dev-learner-id', 'error-handling-test')
      .send({ knowledgeItemId: 'not-a-uuid', grade: 'good' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 (not a crash) for a NotFoundError thrown inside an async handler', async () => {
    const app = createApp();

    const res = await request(app).get(
      '/api/content-graph/qualifications/this-slug-does-not-exist',
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 (not a crash) when requireLearner throws on a missing header', async () => {
    const app = createApp();

    const res = await request(app).get('/api/scheduler/due?qualificationSlug=demo-cert');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
