-- AlterTable
ALTER TABLE "review_events" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "selectedOptionIndex" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "review_events_idempotencyKey_key" ON "review_events"("idempotencyKey");

