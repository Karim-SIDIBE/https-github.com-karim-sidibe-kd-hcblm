-- CreateEnum
CREATE TYPE "ReEngagementStage" AS ENUM ('J3', 'J7', 'J14');

-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('LEARNER', 'ADMIN');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "isEnterprise" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastBlockIndex" INTEGER,
ADD COLUMN     "lastItemKey" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReEngagementMessage" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stage" "ReEngagementStage" NOT NULL,
    "channel" "NotifChannel" NOT NULL DEFAULT 'LEARNER',
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReEngagementMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XapiStatement" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "statement" JSONB NOT NULL,
    "forwarded" BOOLEAN NOT NULL DEFAULT false,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XapiStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReEngagementMessage_enrollmentId_stage_idx" ON "ReEngagementMessage"("enrollmentId", "stage");

-- CreateIndex
CREATE INDEX "XapiStatement_enrollmentId_idx" ON "XapiStatement"("enrollmentId");

-- AddForeignKey
ALTER TABLE "ReEngagementMessage" ADD CONSTRAINT "ReEngagementMessage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XapiStatement" ADD CONSTRAINT "XapiStatement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
