-- Add the ENTERPRISE_ADMIN role (org-scoped self-service admin).
ALTER TYPE "Role" ADD VALUE 'ENTERPRISE_ADMIN';

-- B2B licensing: licensed learner seats per organization.
ALTER TABLE "Organization" ADD COLUMN "seats" INTEGER NOT NULL DEFAULT 0;
