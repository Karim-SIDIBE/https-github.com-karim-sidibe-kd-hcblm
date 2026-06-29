-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL,
    "question" JSONB NOT NULL,
    "subArea" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankQuestion_subArea_idx" ON "BankQuestion"("subArea");
