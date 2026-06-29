-- CreateTable
CREATE TABLE "QuizDraw" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "quizKey" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizDraw_enrollmentId_quizKey_key" ON "QuizDraw"("enrollmentId", "quizKey");

-- AddForeignKey
ALTER TABLE "QuizDraw" ADD CONSTRAINT "QuizDraw_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
