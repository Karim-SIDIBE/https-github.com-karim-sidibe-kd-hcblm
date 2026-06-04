-- B2B seat lifecycle: account deactivation (frees a seat, blocks login).
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
