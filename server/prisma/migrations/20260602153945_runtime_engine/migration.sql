-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PROFILE', 'TRIGGER_QUIZ', 'PEER', 'MICRO_SESSION', 'DIAGNOSTIC_QUIZ', 'CASE_STUDY', 'GUIDED_SCENARIOS', 'FIELD_APPLICATION', 'SELF_ASSESSMENT', 'ACTION_PLAN', 'FINAL_QUIZ', 'PROJECT', 'JOURNAL_ENTRY', 'RUBRIC_EVALUATION');

-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "message" TEXT,
ADD COLUMN     "peerNotified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "peerEmail" TEXT,
ADD COLUMN     "peerName" TEXT;

-- CreateTable
CREATE TABLE "ItemCompletion" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "itemKey" TEXT NOT NULL,
    "scorePct" INTEGER,
    "data" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemCompletion_enrollmentId_idx" ON "ItemCompletion"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCompletion_enrollmentId_blockIndex_itemKey_key" ON "ItemCompletion"("enrollmentId", "blockIndex", "itemKey");

-- AddForeignKey
ALTER TABLE "ItemCompletion" ADD CONSTRAINT "ItemCompletion_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
