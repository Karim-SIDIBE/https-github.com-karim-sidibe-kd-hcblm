-- Historique des webhooks en console : issue du traitement par événement.
ALTER TABLE "PaymentEvent" ADD COLUMN "outcome" TEXT;
