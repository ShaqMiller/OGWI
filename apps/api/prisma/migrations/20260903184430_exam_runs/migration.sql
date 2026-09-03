-- CreateEnum
CREATE TYPE "ExamRunKind" AS ENUM ('SIMULATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExamRunStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "exam_runs" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "kind" "ExamRunKind" NOT NULL DEFAULT 'SIMULATION',
    "status" "ExamRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionCount" INTEGER NOT NULL,
    "allottedSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "correctCount" INTEGER,
    "scoredCount" INTEGER,
    "passed" BOOLEAN,
    "contentGraphVersion" TEXT NOT NULL,
    "passMarkSnapshot" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "exam_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_run_items" (
    "id" TEXT NOT NULL,
    "examRunId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "renderingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "selectedOptionIndex" INTEGER,
    "selectedAt" TIMESTAMP(3),
    "correct" BOOLEAN,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "exam_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_runs_learnerId_qualificationId_status_idx" ON "exam_runs"("learnerId", "qualificationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_run_items_examRunId_position_key" ON "exam_run_items"("examRunId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exam_run_items_examRunId_knowledgeItemId_key" ON "exam_run_items"("examRunId", "knowledgeItemId");

-- CreateIndex
CREATE INDEX "knowledge_items_objectiveId_idx" ON "knowledge_items"("objectiveId");

-- AddForeignKey
ALTER TABLE "exam_runs" ADD CONSTRAINT "exam_runs_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_run_items" ADD CONSTRAINT "exam_run_items_examRunId_fkey" FOREIGN KEY ("examRunId") REFERENCES "exam_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_run_items" ADD CONSTRAINT "exam_run_items_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
