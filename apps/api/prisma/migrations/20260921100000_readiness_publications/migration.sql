-- CreateTable
CREATE TABLE "readiness_publications" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "unlocked" BOOLEAN NOT NULL,
    "oddsPercent" INTEGER,
    "withheld" BOOLEAN NOT NULL,
    "weightedCoveragePercent" INTEGER NOT NULL,
    "certaintyBand" TEXT NOT NULL,
    "passMarkPercent" INTEGER NOT NULL,
    "qualityRatio" DOUBLE PRECISION NOT NULL,
    "celebrationEligible" BOOLEAN NOT NULL,
    "forecastFinishDate" TEXT,
    "forecastItemsRemaining" INTEGER NOT NULL,
    "forecastPaceItemsPerDay" DOUBLE PRECISION NOT NULL,
    "projectedScore" DOUBLE PRECISION NOT NULL,
    "calibrationRatio" DOUBLE PRECISION NOT NULL,
    "meanRatio" DOUBLE PRECISION,
    "calibratedScore" DOUBLE PRECISION NOT NULL,
    "sigma" DOUBLE PRECISION NOT NULL,
    "passMark" DOUBLE PRECISION NOT NULL,
    "oddsRaw" DOUBLE PRECISION NOT NULL,
    "calibrationRuns" JSONB NOT NULL,
    "readinessConfigVersion" TEXT NOT NULL,

    CONSTRAINT "readiness_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "readiness_publications_learnerId_qualificationId_publishedA_idx" ON "readiness_publications"("learnerId", "qualificationId", "publishedAt");
