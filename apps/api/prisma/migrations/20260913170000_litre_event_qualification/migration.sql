-- Every litre event now names the qualification whose economy it belongs to.
--
-- The points balance and Recent list used to reach a row's qualification
-- through its knowledge item. Exam completion premiums have no knowledge item,
-- so every premium was paid but invisible in both.

-- Added nullable first, so existing rows can be backfilled before it is required.
ALTER TABLE "litre_events" ADD COLUMN "qualificationId" TEXT;

-- Per-question litres: through the content graph.
UPDATE "litre_events" AS le
SET "qualificationId" = m."qualificationId"
FROM "knowledge_items" AS ki
JOIN "objectives" AS o ON o."id" = ki."objectiveId"
JOIN "topics" AS t ON t."id" = o."topicId"
JOIN "modules" AS m ON m."id" = t."moduleId"
WHERE le."knowledgeItemId" = ki."id";

-- Exam completion premiums: through the run named in their idempotency key.
UPDATE "litre_events" AS le
SET "qualificationId" = er."qualificationId"
FROM "exam_runs" AS er
WHERE le."qualificationId" IS NULL
  AND le."idempotencyKey" = 'exam-run:' || er."id" || ':premium';

-- Any row still unattributed fails the migration here, loudly, instead of
-- staying silently absent from every balance.
ALTER TABLE "litre_events" ALTER COLUMN "qualificationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "litre_events_learnerId_qualificationId_idx" ON "litre_events"("learnerId", "qualificationId");
