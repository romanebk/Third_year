-- AlterTable
ALTER TABLE "User" ADD COLUMN     "geoConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "geoConsentUpdatedAt" TIMESTAMP(3);
