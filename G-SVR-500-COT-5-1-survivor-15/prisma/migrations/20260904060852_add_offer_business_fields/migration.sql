-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "salaryKind" TEXT,
ADD COLUMN     "salaryMax" DOUBLE PRECISION,
ADD COLUMN     "salaryMin" DOUBLE PRECISION,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "workTime" TEXT;
