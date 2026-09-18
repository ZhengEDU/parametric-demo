-- CreateTable
CREATE TABLE "EquipmentModel" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelNormalized" TEXT NOT NULL,
    "description" TEXT,
    "accuracy" TEXT,
    "range" TEXT,
    "calibrationIntervalMonths" INTEGER,
    "defaultProcedureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentModel_modelNormalized_idx" ON "EquipmentModel"("modelNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentModel_manufacturer_model_key" ON "EquipmentModel"("manufacturer", "model");

-- AddForeignKey
ALTER TABLE "EquipmentModel" ADD CONSTRAINT "EquipmentModel_defaultProcedureId_fkey" FOREIGN KEY ("defaultProcedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
