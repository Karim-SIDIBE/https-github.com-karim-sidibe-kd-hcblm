-- CreateTable
CREATE TABLE "SearchChunk" (
    "id" TEXT NOT NULL,
    "courseVersionId" TEXT NOT NULL,
    "blockIndex" INTEGER,
    "path" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchChunk_courseVersionId_idx" ON "SearchChunk"("courseVersionId");

-- AddForeignKey
ALTER TABLE "SearchChunk" ADD CONSTRAINT "SearchChunk_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
