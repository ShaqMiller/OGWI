-- CreateEnum
CREATE TYPE "FlowTemplateSlot" AS ENUM ('EARLY', 'MID', 'END', 'SPLIT_IN_TWO', 'NONE');

-- CreateEnum
CREATE TYPE "ObjectiveKind" AS ENUM ('FACT_HEAVY', 'CONCEPTUAL');

-- CreateEnum
CREATE TYPE "KeyPointTier" AS ENUM ('CRITICAL', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "RenderingRole" AS ENUM ('BASE', 'VARIANT', 'LADDER');

-- CreateEnum
CREATE TYPE "RenderingFormat" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_RESPONSE', 'TRUE_FALSE', 'TYPED_SHORT_ANSWER', 'AI_MARKED_LONG_ANSWER', 'SEQUENCING', 'MATCHING', 'FILL_IN_THE_BLANKS', 'SORTING', 'PICK_AN_IMAGE');

-- CreateEnum
CREATE TYPE "FlightEventType" AS ENUM ('PUMP', 'LIFTOFF', 'TOUCHDOWN', 'AWARD_EARNED', 'NOTIFICATION_SENT', 'CONFIG_VERSION_MARKER', 'ANNUL');

-- CreateEnum
CREATE TYPE "LitreEventSource" AS ENUM ('THEORY_PAGE', 'QUIZ_ANSWER', 'BLURT', 'TEACH_OGGI', 'DEBRIEF', 'TOPIC_COMPLETION', 'RECALL_DAY', 'ASSESSMENT', 'BONUS');

-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('LITRE', 'PHYSICS', 'SCHEDULER', 'MASTERY', 'OGGI', 'READINESS');

-- CreateTable
CREATE TABLE "qualifications" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentGraphVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "blueprintWeight" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "flowTemplate" TEXT,
    "quizPosition" "FlowTemplateSlot" NOT NULL DEFAULT 'NONE',
    "hasActivitySlot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "ObjectiveKind" NOT NULL,
    "subWeight" DECIMAL(5,4),

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_points" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "plainName" TEXT NOT NULL,
    "cueQuestion" TEXT NOT NULL,
    "tier" "KeyPointTier" NOT NULL,

    CONSTRAINT "key_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "keyPointId" TEXT,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renderings" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "role" "RenderingRole" NOT NULL,
    "format" "RenderingFormat" NOT NULL,
    "content" JSONB NOT NULL,
    "lastServedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renderings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confusable_edges" (
    "id" TEXT NOT NULL,
    "itemAId" TEXT NOT NULL,
    "itemBId" TEXT NOT NULL,
    "confirmedByRef" TEXT NOT NULL,

    CONSTRAINT "confusable_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flights" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_events" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "eventType" "FlightEventType" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "appendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" BIGSERIAL NOT NULL,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL,
    "annulsEventId" TEXT,
    "physicsConfigVersion" TEXT NOT NULL,
    "litreConfigVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "litre_events" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "flightId" TEXT,
    "source" "LitreEventSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "knowledgeItemId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "litreConfigVersion" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "litre_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_documents" (
    "id" TEXT NOT NULL,
    "configType" "ConfigType" NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qualifications_slug_key" ON "qualifications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "modules_qualificationId_order_key" ON "modules"("qualificationId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "topics_moduleId_order_key" ON "topics"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_topicId_order_key" ON "objectives"("topicId", "order");

-- CreateIndex
CREATE INDEX "renderings_knowledgeItemId_idx" ON "renderings"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "confusable_edges_itemAId_itemBId_key" ON "confusable_edges"("itemAId", "itemBId");

-- CreateIndex
CREATE INDEX "flights_learnerId_idx" ON "flights"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "flight_events_idempotencyKey_key" ON "flight_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "flight_events_flightId_effectiveAt_idx" ON "flight_events"("flightId", "effectiveAt");

-- CreateIndex
CREATE INDEX "flight_events_learnerId_effectiveAt_idx" ON "flight_events"("learnerId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "litre_events_idempotencyKey_key" ON "litre_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "litre_events_learnerId_effectiveAt_idx" ON "litre_events"("learnerId", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "config_documents_configType_version_key" ON "config_documents"("configType", "version");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_points" ADD CONSTRAINT "key_points_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_keyPointId_fkey" FOREIGN KEY ("keyPointId") REFERENCES "key_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renderings" ADD CONSTRAINT "renderings_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_events" ADD CONSTRAINT "flight_events_annulsEventId_fkey" FOREIGN KEY ("annulsEventId") REFERENCES "flight_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_events" ADD CONSTRAINT "flight_events_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Structural guarantees that Prisma's schema language can't express
-- declaratively (see the comments in schema.prisma next to each model).
-- These are cheap now and expensive to retrofit once real data exists.

-- Invariant: litres never subtract. A negative-amount row can never be
-- written, full stop - not just "the app doesn't happen to write one".
ALTER TABLE "litre_events" ADD CONSTRAINT "litre_events_amount_non_negative" CHECK ("amount" >= 0);

-- Invariant: at most one TOUCHDOWN event per flight (touchdown is
-- materialised once, at first discovery, and never re-materialised).
CREATE UNIQUE INDEX "flight_events_one_touchdown_per_flight"
  ON "flight_events" ("flightId")
  WHERE "eventType" = 'TOUCHDOWN';

-- Invariant: at most one AWARD_EARNED event per learner per award. Award
-- identity lives in the JSON payload at this schema-only stage (no awards
-- table exists yet), so this is a JSON-path expression index rather than a
-- plain column index.
CREATE UNIQUE INDEX "flight_events_one_award_earned_per_learner"
  ON "flight_events" ("learnerId", (("payload"->>'awardSlug')))
  WHERE "eventType" = 'AWARD_EARNED';
