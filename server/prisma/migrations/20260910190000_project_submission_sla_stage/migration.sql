-- Relances SLA multi-étages du projet Bloc 4 (0 = aucune, 1..3 = J+3/J+5/J+7 ouvrés)
ALTER TABLE "ProjectSubmission" ADD COLUMN "slaStage" INTEGER NOT NULL DEFAULT 0;
-- Dossiers historiques déjà alertés une fois (ancien système) : considérer
-- l'étage « urgence » consommé pour ne pas re-notifier en double.
UPDATE "ProjectSubmission" SET "slaStage" = 2 WHERE "slaAlertedAt" IS NOT NULL;
