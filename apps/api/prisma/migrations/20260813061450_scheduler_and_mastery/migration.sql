-- CreateEnum
CREATE TYPE "SchedulerCardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "ReviewGrade" AS ENUM ('AGAIN', 'GOOD');

-- CreateTable
CREATE TABLE "item_memory_states" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "SchedulerCardState" NOT NULL DEFAULT 'NEW',
    "schedulerConfigVersion" TEXT NOT NULL,

    CONSTRAINT "item_memory_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_events" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "renderingId" TEXT,
    "grade" "ReviewGrade" NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingDifficulty" DOUBLE PRECISION NOT NULL,
    "resultingStability" DOUBLE PRECISION NOT NULL,
    "resultingDue" TIMESTAMP(3) NOT NULL,
    "schedulerConfigVersion" TEXT NOT NULL,

    CONSTRAINT "review_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_mastery" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "displayedScore" DOUBLE PRECISION NOT NULL,
    "lastPublishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_memory_states_learnerId_due_idx" ON "item_memory_states"("learnerId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "item_memory_states_learnerId_knowledgeItemId_key" ON "item_memory_states"("learnerId", "knowledgeItemId");

-- CreateIndex
CREATE INDEX "review_events_learnerId_knowledgeItemId_idx" ON "review_events"("learnerId", "knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "published_mastery_learnerId_moduleId_key" ON "published_mastery"("learnerId", "moduleId");

-- AddForeignKey
ALTER TABLE "item_memory_states" ADD CONSTRAINT "item_memory_states_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_mastery" ADD CONSTRAINT "published_mastery_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
