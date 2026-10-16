-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];
