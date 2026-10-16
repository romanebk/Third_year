-- Clé d'API fournie par l'utilisateur pour un service "apikey" (Steam,
-- YouTube), chiffrée en AES-256-GCM comme les tokens OAuth. Nullable : absente
-- quand le serveur fournit sa propre clé, et pour les services OAuth.
ALTER TABLE "ServiceSubscription" ADD COLUMN "apiKey" TEXT;
