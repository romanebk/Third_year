-- Retrait du service Spotify (remplacé par YouTube) : migration de données
-- uniquement, aucun changement de schéma. Sans elle, une instance
-- spotify_currently_playing restée en base s'afficherait en erreur 404
-- permanente sur le dashboard, et une souscription/un compte lié resteraient
-- orphelins d'un service qui n'existe plus.

DELETE FROM "WidgetInstance" WHERE "service" = 'spotify';
DELETE FROM "ServiceSubscription" WHERE "service" = 'spotify';
DELETE FROM "Account" WHERE "provider" = 'spotify';

-- Renumérote les positions de chaque dashboard (0..n-1) : les instances
-- supprimées ci-dessus laisseraient des trous, et POST /api/dashboard place
-- la nouvelle instance à position = nombre d'instances, qui pourrait alors
-- entrer en collision avec une position existante (cf. ADR 0005).
UPDATE "WidgetInstance" AS w
SET "position" = ranked.new_position
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "position", "createdAt") - 1 AS new_position
  FROM "WidgetInstance"
) AS ranked
WHERE w."id" = ranked."id" AND w."position" <> ranked.new_position;
