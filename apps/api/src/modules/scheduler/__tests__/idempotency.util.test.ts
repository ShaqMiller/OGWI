import { describe, expect, it } from 'vitest';
import { actSource, examItemActKey, litreKey, pumpKey, reviewActKey } from '../idempotency.util.js';

describe('idempotency keys', () => {
  it('scopes a practice attempt to its learner', () => {
    // LitreEvent.idempotencyKey is globally unique, so an unprefixed client
    // uuid would let one learner consume a key another learner still needed.
    const attemptId = 'a1b2c3d4-0000-0000-0000-000000000000';

    expect(reviewActKey('learner-a', attemptId)).not.toBe(reviewActKey('learner-b', attemptId));
    expect(reviewActKey('learner-a', attemptId)).toBe(`review:learner-a:${attemptId}`);
  });

  it('gives two attempts on the same item different keys', () => {
    // The whole point: repetition stays legal, only retries are deduped.
    expect(reviewActKey('learner-a', 'attempt-1')).not.toBe(
      reviewActKey('learner-a', 'attempt-2'),
    );
  });

  it('derives one act key per exam question', () => {
    expect(examItemActKey('item-1')).toBe('exam-item:item-1');
    expect(examItemActKey('item-1')).not.toBe(examItemActKey('item-2'));
  });

  it('namespaces each subsystem under the act', () => {
    const act = reviewActKey('learner-a', 'attempt-1');

    expect(litreKey(act)).toBe(`${act}:litre`);
    expect(pumpKey(act)).toBe(`${act}:pump`);
    expect(litreKey(act)).not.toBe(pumpKey(act));
  });

  it('keeps practice and exam namespaces apart', () => {
    // An id colliding across namespaces must not collapse two acts into one.
    expect(examItemActKey('x').split(':')[0]).not.toBe(reviewActKey('l', 'x').split(':')[0]);
  });

  it('reads the source of an act back from its key', () => {
    expect(actSource(reviewActKey('learner-a', 'attempt-1'))).toBe('practice');
    expect(actSource(examItemActKey('item-1'))).toBe('exam');
    expect(actSource(null)).toBe('unknown');
    expect(actSource('something-else:1')).toBe('unknown');
  });
});
