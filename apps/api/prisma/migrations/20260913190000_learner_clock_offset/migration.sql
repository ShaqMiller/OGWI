-- CreateTable
CREATE TABLE "learner_clock_offsets" (
    "learnerId" TEXT NOT NULL,
    "offsetSeconds" INTEGER NOT NULL,

    CONSTRAINT "learner_clock_offsets_pkey" PRIMARY KEY ("learnerId")
);
