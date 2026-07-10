-- AlterTable
ALTER TABLE "BankQuestion" ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "sourceCourseId" TEXT,
ADD COLUMN     "sourceQuestionId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'approved';

-- CreateIndex
CREATE INDEX "BankQuestion_status_idx" ON "BankQuestion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BankQuestion_sourceCourseId_sourceQuestionId_key" ON "BankQuestion"("sourceCourseId", "sourceQuestionId");

