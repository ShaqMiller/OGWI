import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../lib/prisma.js';
import * as recallService from '../recall.service.js';

let ipAddressingTopicId: string;
let pmLifecycleTopicId: string;

beforeAll(async () => {
  const ipAddressing = await prisma.topic.findFirstOrThrow({
    where: { name: 'IP Addressing' },
  });
  ipAddressingTopicId = ipAddressing.id;

  const pmLifecycle = await prisma.topic.findFirstOrThrow({
    where: { name: 'The Project Lifecycle' },
  });
  pmLifecycleTopicId = pmLifecycle.id;
});

describe('recall.service', () => {
  it('lists a topic\'s key points', async () => {
    const result = await recallService.getTopicKeyPoints(ipAddressingTopicId);

    expect(result.topicName).toBe('IP Addressing');
    expect(result.keyPoints.length).toBeGreaterThan(0);
  });

  it('throws NotFoundError for an unknown topic', async () => {
    await expect(
      recallService.getTopicKeyPoints('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow();
  });

  it('matches a key point when its meaningful words appear in the text', async () => {
    const result = await recallService.scoreText(
      ipAddressingTopicId,
      'IP addresses are grouped into classes from A to E.',
    );

    expect(result.matched.some((kp) => kp.plainName.includes('grouped into classes'))).toBe(true);
    expect(result.coverage).toBeGreaterThan(0);
  });

  it('leaves everything unmatched for unrelated text, never marks anything incorrect', async () => {
    const result = await recallService.scoreText(
      ipAddressingTopicId,
      'bananas are a good source of potassium',
    );

    expect(result.matched).toHaveLength(0);
    expect(result.coverage).toBe(0);
    expect(result.unmatched.length).toBeGreaterThan(0);
  });

  it('reports a qualification with no seeded key points as honestly empty', async () => {
    const result = await recallService.getTopicKeyPoints(pmLifecycleTopicId);

    expect(result.keyPoints).toHaveLength(0);
  });
});
