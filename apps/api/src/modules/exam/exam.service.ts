import {
  EXAM_MIN_QUESTION_COUNT,
  EXAM_SECONDS_PER_QUESTION,
  EXAM_TARGET_QUESTION_COUNT,
  type ExamPaper,
  type ExamResultQuestion,
  type ExamResults,
  type StartExamRunResponse,
} from '@ogwi/shared';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import * as contentGraphService from '../content-graph/content-graph.service.js';
import * as economyService from '../economy/economy.service.js';
import * as flightService from '../flight/flight.service.js';
import {
  examItemActKey,
  examRunPremiumKey,
  litreKey,
  pumpKey,
} from '../scheduler/idempotency.util.js';
import * as schedulerService from '../scheduler/scheduler.service.js';
import * as examRepository from './exam.repository.js';
import { allocatePaper, buildPaperOrder } from './paper-blueprint.util.js';
import type { ExamRunRow } from './exam.types.js';

/**
 * Business logic only. Never touches req/res, never imports Prisma types.
 *
 * Exam runs (Doc 2 A5). The defining constraint is invariant 10 - "exam mode
 * contains no aid machinery" - which here means nothing this module returns
 * while a run is IN_PROGRESS may hint at correctness. Answers are saved
 * blind; everything is marked at submit.
 */

export async function startRun(
  learnerId: string,
  qualificationSlug: string,
): Promise<StartExamRunResponse> {
  const qualification = await contentGraphService.getQualificationBySlug(qualificationSlug);
  const modules = await examRepository.findEligibleItemsByModule(qualification.id);

  const allocations = allocatePaper(
    modules.map((module) => ({
      moduleId: module.moduleId,
      order: module.order,
      blueprintWeight: module.blueprintWeight,
      eligibleItemIds: module.eligibleItems.map((item) => item.knowledgeItemId),
    })),
    EXAM_TARGET_QUESTION_COUNT,
    Math.random,
  );

  const order = buildPaperOrder(allocations, Math.random);

  if (order.length < EXAM_MIN_QUESTION_COUNT) {
    throw new ValidationError(
      `"${qualificationSlug}" doesn't have enough exam-ready content yet`,
      { eligibleItemCount: order.length },
    );
  }

  // Every eligible item already carries the rendering the paper will serve,
  // so the served rendering is fixed at generation - it can't drift between
  // being shown and being marked.
  const renderingByItem = new Map(
    modules
      .flatMap((module) => module.eligibleItems)
      .map((item) => [item.knowledgeItemId, item.renderingId]),
  );

  const questionCount = order.length;
  // Derived from the REAL paper, never the target - an 8-question paper must
  // not advertise a 30-question paper's duration (Doc 2 A5 shows both).
  const allottedSeconds = questionCount * EXAM_SECONDS_PER_QUESTION;

  const runId = await examRepository.createRun({
    learnerId,
    qualificationId: qualification.id,
    questionCount,
    allottedSeconds,
    contentGraphVersion: qualification.contentGraphVersion,
    passMark: qualification.passMark,
    items: order.map((question, position) => ({
      knowledgeItemId: question.knowledgeItemId,
      renderingId: renderingByItem.get(question.knowledgeItemId) as string,
      position,
    })),
  });

  return { runId, questionCount, allottedSeconds };
}

async function loadRun(runId: string, learnerId: string): Promise<ExamRunRow> {
  const run = await examRepository.findRun(runId, learnerId);

  // 404 rather than 403 for someone else's run: "doesn't exist" and "not
  // yours" must be indistinguishable, so run ids can't be probed.
  if (!run) throw new NotFoundError(`No exam run "${runId}"`);

  return run;
}

/** The paper as sat. Carries no answer key - see examQuestionSchema. */
export async function getPaper(runId: string, learnerId: string): Promise<ExamPaper> {
  const run = await loadRun(runId, learnerId);
  const prompts = await Promise.all(
    run.items.map((item) => contentGraphService.getKnowledgeItemPrompt(item.knowledgeItemId)),
  );

  return {
    runId: run.id,
    qualificationSlug: run.qualificationSlug,
    qualificationName: run.qualificationName,
    status: run.status,
    questionCount: run.questionCount,
    allottedSeconds: run.allottedSeconds,
    startedAt: run.startedAt,
    questions: run.items.map((item, index) => {
      const prompt = prompts[index] as (typeof prompts)[number];
      return {
        position: item.position,
        knowledgeItemId: item.knowledgeItemId,
        renderingId: item.renderingId,
        format: prompt.format,
        prompt: prompt.prompt,
        options: prompt.options,
        selectedOptionIndex: item.selectedOptionIndex,
      };
    }),
  };
}

/**
 * Records a selection and says nothing else. No verdict, no memory state, no
 * points - a save must be indistinguishable whether the answer was right or
 * wrong, including in how long it takes.
 */
export async function saveAnswer(
  runId: string,
  learnerId: string,
  knowledgeItemId: string,
  selectedOptionIndex: number,
): Promise<void> {
  const run = await loadRun(runId, learnerId);

  if (run.status === 'SUBMITTED') {
    throw new ValidationError('This exam has already been submitted', { runId });
  }

  const item = run.items.find((candidate) => candidate.knowledgeItemId === knowledgeItemId);
  if (!item) throw new NotFoundError(`Question is not on exam run "${runId}"`);

  // Range-check without marking: getOptionCount deliberately returns only how
  // many options exist, which the client already knows.
  const optionCount = await contentGraphService.getOptionCount(knowledgeItemId, item.renderingId);
  if (selectedOptionIndex >= optionCount) {
    throw new ValidationError('That option does not exist on this question', {
      selectedOptionIndex,
    });
  }

  const saved = await examRepository.saveSelection({
    runId,
    learnerId,
    knowledgeItemId,
    selectedOptionIndex,
  });

  // Lost a race with a concurrent submit between the read above and the write.
  if (!saved) throw new ValidationError('This exam has already been submitted', { runId });
}

/**
 * Marks and finalises a run, then writes the engine events.
 *
 * Two phases, and the split is the point: the learner's result becomes
 * durable BEFORE any engine write happens. Phase 2 is separately resumable,
 * so a failure part-way leaves a complete, viewable results screen and a
 * retry that picks up where it stopped rather than double-writing.
 *
 * Fully idempotent - submitting twice returns the same result and writes
 * nothing the second time.
 */
export async function submitRun(runId: string, learnerId: string): Promise<ExamResults> {
  const run = await loadRun(runId, learnerId);

  if (run.status === 'IN_PROGRESS') {
    await markAndFreeze(run);
  }

  await writeEngineEvents(runId, learnerId);
  await awardCompletionPremium(runId, learnerId);

  return getResults(runId, learnerId);
}

/**
 * Pays the run's completion premium (Doc 2 B8), once.
 *
 * Runs after the per-question grading so the premium is genuinely "on
 * completion", and keyed on the run so a resumed or retried submit cannot pay
 * it twice - unlike the per-question keys, which are per batch.
 *
 * The premium pumps the flight too: litres and fill are the same currency, and
 * this is the payment that makes a mock the biggest climb in the product.
 */
async function awardCompletionPremium(runId: string, learnerId: string): Promise<void> {
  const run = await loadRun(runId, learnerId);

  const amount = economyService.priceExamPremium({
    kind: run.kind,
    answeredCount: run.items.filter((item) => item.selectedOptionIndex !== null).length,
    questionCount: run.items.length,
  });

  const paid = await economyService.awardExamPremium({
    learnerId,
    qualificationId: run.qualificationId,
    amount,
    idempotencyKey: examRunPremiumKey(runId),
  });

  if (paid) {
    await flightService.pump(
      learnerId,
      run.qualificationId,
      amount,
      pumpKey(examRunPremiumKey(runId)),
    );
  }
}

async function markAndFreeze(run: ExamRunRow): Promise<void> {
  const answered = run.items.filter((item) => item.selectedOptionIndex !== null);

  const verdicts = await contentGraphService.checkAnswers(
    answered.map((item) => ({
      knowledgeItemId: item.knowledgeItemId,
      renderingId: item.renderingId,
      answer: {
        kind: 'option_index' as const,
        selectedOptionIndex: item.selectedOptionIndex as number,
      },
    })),
  );

  const correctCount = [...verdicts.values()].filter((verdict) => verdict.correct).length;
  // Unanswered questions count against the score - that's exam scoring - but
  // they are NOT graded, so they write no review event. See writeEngineEvents.
  const scoredCount = run.items.length;
  const passed = scoredCount > 0 && correctCount / scoredCount >= run.passMarkSnapshot;

  await examRepository.finaliseRun({
    runId: run.id,
    marks: run.items.map((item) => ({
      itemId: item.id,
      correct: verdicts.has(item.knowledgeItemId)
        ? (verdicts.get(item.knowledgeItemId) as { correct: boolean }).correct
        : null,
    })),
    correctCount,
    scoredCount,
    passed,
    submittedAt: new Date(),
  });
}

/**
 * One review event per ANSWERED question (Doc 2 B1), and one flight pump for
 * the whole paper.
 *
 * Unanswered questions write nothing. FSRS grades a retrieval attempt, and a
 * question someone ran out of time on isn't one - invariant 6 says mastery
 * falls only via a failed previously-known item or time decay, and a skipped
 * question is neither. It also fails safe: an ungraded item just stays
 * uncovered, whereas a spurious Again is permanent in an append-only log.
 */
async function writeEngineEvents(runId: string, learnerId: string): Promise<void> {
  const run = await loadRun(runId, learnerId);
  const now = new Date();
  let totalPoints = 0;
  let lastGradedItemId: string | null = null;
  let firstClaimedItemId: string | null = null;

  for (const item of run.items) {
    if (item.selectedOptionIndex === null || item.correct === null) continue;
    if (item.gradedAt !== null) continue;

    // Claim before grading, so a retry after a crash can never double-write.
    const claimed = await examRepository.claimForGrading(item.id, now);
    if (!claimed) continue;

    firstClaimedItemId ??= item.id;

    const { pointsAwarded } = await schedulerService.gradeReviewDeferringPump(
      learnerId,
      item.knowledgeItemId,
      item.correct ? 'good' : 'again',
      item.renderingId,
      examItemActKey(item.id),
      item.selectedOptionIndex,
    );

    totalPoints += pointsAwarded;
    lastGradedItemId = item.knowledgeItemId;
  }

  // One pump for the paper rather than one per question: pumping replays the
  // whole flight history each time, so per-item would be quadratic.
  //
  // The key is per BATCH, not per run. submitRun is resumable, so a second
  // invocation claims whatever items remain and pumps a different total -
  // keying on runId would find the key taken, no-op, and silently lose that
  // batch's altitude. claimForGrading guarantees batches are disjoint, so the
  // first item claimed in this pass names it uniquely.
  if (totalPoints > 0 && lastGradedItemId && firstClaimedItemId) {
    await schedulerService.pumpForKnowledgeItem(
      learnerId,
      lastGradedItemId,
      totalPoints,
      pumpKey(examItemActKey(firstClaimedItemId)),
    );
  }
}

export async function getResults(runId: string, learnerId: string): Promise<ExamResults> {
  const run = await loadRun(runId, learnerId);

  if (run.status !== 'SUBMITTED') {
    throw new ValidationError('This exam has not been submitted yet', { runId });
  }

  const pairs = run.items.map((item) => ({
    knowledgeItemId: item.knowledgeItemId,
    renderingId: item.renderingId,
  }));

  const [prompts, sources, answerKeys] = await Promise.all([
    Promise.all(
      run.items.map((item) => contentGraphService.getKnowledgeItemPrompt(item.knowledgeItemId)),
    ),
    examRepository.findItemSources(run.items.map((item) => item.knowledgeItemId)),
    // The key is read here rather than stored on the run: it stays owned by
    // content-graph, and a corrected answer key fixes past results screens.
    contentGraphService.findAnswerKeys(pairs),
  ]);

  const questions: ExamResultQuestion[] = run.items.map((item, index) => {
    const prompt = prompts[index] as (typeof prompts)[number];
    const source = sources.get(item.knowledgeItemId);
    const key = answerKeys.get(item.knowledgeItemId);

    return {
      position: item.position,
      knowledgeItemId: item.knowledgeItemId,
      prompt: prompt.prompt,
      options: prompt.options,
      selectedOptionIndex: item.selectedOptionIndex,
      correctOptionIndex: key?.correctOptionIndex ?? 0,
      correct: item.correct,
      topicName: source?.topicName ?? '',
      moduleName: source?.moduleName ?? '',
      explanation: key?.explanation ?? null,
    };
  });

  const scoredCount = run.scoredCount ?? run.items.length;
  const correctCount = run.correctCount ?? 0;
  const submittedAt = run.submittedAt ?? new Date();

  // Read what this run actually paid rather than recomputing it: per-question
  // pricing depends on the memory state at the moment of each answer, which
  // can't be reconstructed after the fact.
  const litresEarned = await economyService.sumLitresForKeys([
    ...run.items.map((item) => litreKey(examItemActKey(item.id))),
    examRunPremiumKey(run.id),
  ]);

  return {
    runId: run.id,
    qualificationSlug: run.qualificationSlug,
    qualificationName: run.qualificationName,
    correctCount,
    scoredCount,
    scorePercent: Math.round((correctCount / scoredCount) * 100),
    passMarkPercent: Math.round(run.passMarkSnapshot * 100),
    passed: run.passed ?? false,
    answeredCount: run.items.filter((item) => item.selectedOptionIndex !== null).length,
    allottedSeconds: run.allottedSeconds,
    secondsUsed: Math.max(
      0,
      Math.round((submittedAt.getTime() - run.startedAt.getTime()) / 1000),
    ),
    litresEarned,
    questions,
  };
}
