-- PostGIS est déjà actif sur la base réelle (fourni par l'image Docker
-- postgis/postgis), mais son activation n'a jamais été une migration suivie :
-- une base neuve (ou la base fictive que Prisma crée pour valider les
-- migrations) ne l'a pas. Idempotent, sans effet sur une base où il est déjà là.
CREATE EXTENSION IF NOT EXISTS postgis;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "geoPoint" geography(Point, 4326);

-- Backfill : synchronise geoPoint pour toutes les offres déjà en base.
UPDATE "Offer" SET "geoPoint" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;

-- Index GIST : c'est lui qui manquait pour que ST_DWithin/ST_Distance ne fassent
-- plus un Seq Scan complet de la table à chaque recherche de proximité.
CREATE INDEX "Offer_geoPoint_idx" ON "Offer" USING GIST ("geoPoint");

-- Trigger : synchronise geoPoint depuis latitude/longitude à chaque écriture,
-- côté base plutôt que côté applicatif. Plusieurs chemins de code écrivent
-- latitude/longitude (création d'offre, migration IGN, scripts de reprise,
-- seed) ; un trigger garantit qu'aucun d'eux ne peut oublier de le faire.
CREATE OR REPLACE FUNCTION offer_sync_geopoint() RETURNS trigger AS $$
BEGIN
  NEW."geoPoint" := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER offer_geopoint_sync
BEFORE INSERT OR UPDATE OF latitude, longitude ON "Offer"
FOR EACH ROW EXECUTE FUNCTION offer_sync_geopoint();
