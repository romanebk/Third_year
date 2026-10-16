-- Extension PostGIS, à exécuter après la première migration Prisma
-- Commande : psql $DATABASE_URL -f prisma/scripts/postgis/enable_postgis.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Index spatial optionnel pour optimiser ST_DWithin sur les offres actives.
-- Les coordonnées lat/lng restent dans Prisma ; PostGIS est utilisé via $queryRaw.
-- CREATE INDEX IF NOT EXISTS offer_location_gist ON "Offer"
--   USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
--   WHERE status = 'ACTIVE';
