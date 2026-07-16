-- CreateTable
CREATE TABLE "UiText" (
    "id" TEXT NOT NULL,
    "app" TEXT NOT NULL DEFAULT 'web',
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UiText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UiText_app_locale_key_key" ON "UiText"("app", "locale", "key");

