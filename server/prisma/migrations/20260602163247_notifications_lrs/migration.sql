-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('CONSOLE', 'EMAIL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('LEARNER', 'PEER', 'ADMIN');

-- AlterTable
ALTER TABLE "XapiStatement" ADD COLUMN     "forwardError" TEXT,
ADD COLUMN     "forwardedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "recipientKind" "RecipientKind" NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'CONSOLE',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_enrollmentId_idx" ON "Notification"("enrollmentId");

-- CreateIndex
CREATE INDEX "XapiStatement_forwarded_idx" ON "XapiStatement"("forwarded");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
