-- AlterTable
ALTER TABLE "JournalTrigger" ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- Backfill : toute entrée ouverte depuis plus de 24 h est considérée comme
-- déjà rappelée. L'ancienne garde (marqueur `provider` de Notification,
-- réécrit au dispatch) laissait le rappel repartir à chaque exécution
-- horaire ; ce backfill garantit qu'aucun apprenant déjà touché ne recevra
-- un rappel de plus après ce déploiement.
UPDATE "JournalTrigger" SET "remindedAt" = NOW()
WHERE "remindedAt" IS NULL AND "sentAt" < NOW() - INTERVAL '24 hours';
