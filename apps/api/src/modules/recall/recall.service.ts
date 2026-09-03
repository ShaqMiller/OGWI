import { NotFoundError } from '../../errors/index.js';
import * as recallRepository from './recall.repository.js';
import type { TopicKeyPointRecord, TopicKeyPoints } from './recall.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * scoreText() is the placeholder AI marker for both Blurt and Teach Oggi
 * (Doc 2 B6/B7 - "one fair marker wearing two costumes"). It is honest
 * keyword matching, not semantic understanding: a key point counts as
 * matched when enough of its plain-name's meaningful words show up
 * somewhere in the learner's text. Nothing is persisted here - this is a
 * pure per-request computation, not wired into scheduler/mastery/economy.
 *
 * Deliberately has no "incorrect" outcome - a keyword match can never
 * safely detect a wrong statement, only an absent one. Every key point
 * ends up Matched or Unmatched, which happens to line up with the
 * benefit-of-the-doubt spirit of the original spec, even though that's a
 * side effect of the simplification rather than a deliberate reimplementation
 * of it.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'and', 'or',
  'but', 'as', 'that', 'this', 'these', 'those', 'it', 'its', 'into',
  'than', 'then', 'so', 'such', 'can', 'will', 'would', 'should', 'has',
  'have', 'had', 'do', 'does', 'did', 'not', 'no',
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function significantWords(plainName: string): string[] {
  return normalizeWords(plainName).filter((word) => !STOPWORDS.has(word));
}

function isMatched(keyPoint: TopicKeyPointRecord, textWords: Set<string>): boolean {
  const words = significantWords(keyPoint.plainName);
  if (words.length === 0) return false;

  const hits = words.filter((word) => textWords.has(word)).length;
  return hits / words.length >= 0.5;
}

export async function getTopicKeyPoints(topicId: string): Promise<TopicKeyPoints> {
  const result = await recallRepository.findTopicKeyPoints(topicId);

  if (!result) {
    throw new NotFoundError(`No topic with id "${topicId}"`);
  }

  return result;
}

export interface ScoreTextResult {
  coverage: number;
  matched: TopicKeyPointRecord[];
  unmatched: TopicKeyPointRecord[];
}

export async function scoreText(topicId: string, text: string): Promise<ScoreTextResult> {
  const { keyPoints } = await getTopicKeyPoints(topicId);
  const textWords = new Set(normalizeWords(text));

  const matched: TopicKeyPointRecord[] = [];
  const unmatched: TopicKeyPointRecord[] = [];

  for (const keyPoint of keyPoints) {
    (isMatched(keyPoint, textWords) ? matched : unmatched).push(keyPoint);
  }

  const coverage = keyPoints.length === 0 ? 0 : Math.round((matched.length / keyPoints.length) * 100);

  return { coverage, matched, unmatched };
}
