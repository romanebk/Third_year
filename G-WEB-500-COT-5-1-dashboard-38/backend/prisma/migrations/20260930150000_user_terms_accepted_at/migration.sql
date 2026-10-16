-- Date d'acceptation des Conditions d'utilisation et de la Politique de
-- confidentialité. Nullable : les comptes existants n'ont pas encore donné ce
-- consentement explicite.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
