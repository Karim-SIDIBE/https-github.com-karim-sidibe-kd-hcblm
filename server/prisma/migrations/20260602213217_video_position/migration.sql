-- CreateTable
CREATE TABLE "MediaPosition" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaPosition_enrollmentId_idx" ON "MediaPosition"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaPosition_enrollmentId_blockIndex_itemKey_key" ON "MediaPosition"("enrollmentId", "blockIndex", "itemKey");

-- AddForeignKey
ALTER TABLE "MediaPosition" ADD CONSTRAINT "MediaPosition_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
