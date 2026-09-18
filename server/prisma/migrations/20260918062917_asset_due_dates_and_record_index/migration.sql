-- AlterTable
ALTER TABLE "EquipmentAsset" ADD COLUMN     "lastCalibratedAt" TIMESTAMP(3),
ADD COLUMN     "nextCalibrationDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CalibrationRecord_updatedAt_idx" ON "CalibrationRecord"("updatedAt");

-- CreateIndex
CREATE INDEX "EquipmentAsset_nextCalibrationDueAt_idx" ON "EquipmentAsset"("nextCalibrationDueAt");
