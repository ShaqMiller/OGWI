-- AlterTable
ALTER TABLE "readiness_publications" ADD COLUMN     "celebrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstScore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forecastFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextAction" JSONB;
