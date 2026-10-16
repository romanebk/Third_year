-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "geocodeCitycode" TEXT,
ADD COLUMN     "geocodeScore" DOUBLE PRECISION,
ADD COLUMN     "geocodeSource" TEXT,
ADD COLUMN     "geocodedAt" TIMESTAMP(3);
