-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('DIGITAL_FIELD', 'LEGACY_PAPER');

-- AlterTable
ALTER TABLE "CalibrationRecord" ADD COLUMN     "entryMode" "EntryMode" NOT NULL DEFAULT 'DIGITAL_FIELD',
ADD COLUMN     "legacyScanFilename" TEXT,
ADD COLUMN     "legacyScanStoragePath" TEXT,
ADD COLUMN     "legacyScanUploadedAt" TIMESTAMP(3),
ADD COLUMN     "purposeOfVisit" TEXT,
ADD COLUMN     "serviceRequested" TEXT;
