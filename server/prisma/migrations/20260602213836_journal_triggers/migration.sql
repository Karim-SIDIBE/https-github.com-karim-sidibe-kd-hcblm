-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "journalStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JournalTrigger" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalTrigger_enrollmentId_idx" ON "JournalTrigger"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTrigger_enrollmentId_day_key" ON "JournalTrigger"("enrollmentId", "day");

-- AddForeignKey
ALTER TABLE "JournalTrigger" ADD CONSTRAINT "JournalTrigger_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
