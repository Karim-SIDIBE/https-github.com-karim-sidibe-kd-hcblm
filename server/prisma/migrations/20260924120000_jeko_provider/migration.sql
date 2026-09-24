-- Jèko (Partner API) rejoint le registre des fournisseurs de paiement.
ALTER TYPE "PaymentProviderId" ADD VALUE IF NOT EXISTS 'JEKO';
