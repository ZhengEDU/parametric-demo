-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('TECHNICIAN', 'DOCUMENTATION', 'MANAGER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "DocumentFamily" AS ENUM ('CALIBRATION_CERTIFICATE', 'PREVENTATIVE_MAINTENANCE_REPORT');

-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED_FOR_CORRECTION', 'RESUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DOCUMENT_GENERATED', 'SYNCED_TO_CALIBRATION_CONTROL', 'READY_FOR_RELEASE', 'RELEASED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'ACTIVE_DEMO', 'RETIRED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED', 'SYNCING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('IN_TOLERANCE', 'OUT_OF_TOLERANCE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FinalStatus" AS ENUM ('PASS', 'FAIL', 'LIMITED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ChecklistResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('RETURNED_FOR_CORRECTION', 'APPROVED');

-- CreateEnum
CREATE TYPE "RevisionAction" AS ENUM ('SUBMITTED', 'RESUBMITTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSite" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAsset" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "accuracy" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "defaultProcedureId" TEXT,
    "calibrationIntervalMonths" INTEGER NOT NULL,
    "ccAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentFamily" "DocumentFamily" NOT NULL,
    "calculationRuleRevision" TEXT NOT NULL,
    "decisionRuleRevision" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digitalFormTemplateRevisionId" TEXT,
    "outputWordTemplateRevisionId" TEXT,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalFormTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalFormTemplateRevision" (
    "id" TEXT NOT NULL,
    "digitalFormTemplateId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "formSchema" JSONB NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'ACTIVE_DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalFormTemplateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationTask" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "assignedTechnicianId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRecord" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "status" "WorkflowState" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0,
    "calibrationLocation" TEXT,
    "comments" TEXT,
    "asFoundStatus" "ConditionStatus",
    "asLeftStatus" "ConditionStatus",
    "adjustmentMade" BOOLEAN,
    "finalStatus" "FinalStatus",
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationRecordRevision" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "action" "RevisionAction" NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationRecordRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementSection" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeasurementSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementGroup" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "parentGroupId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeasurementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementPoint" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rowLabel" TEXT NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "MeasurementPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMChecklistSection" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PMChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PMChecklistItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "result" "ChecklistResult",
    "notes" TEXT,

    CONSTRAINT "PMChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalObservation" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "numericValue" DECIMAL(18,6),
    "displayScale" INTEGER NOT NULL DEFAULT 2,
    "displayValue" TEXT,
    "asFoundStatus" "ConditionStatus",
    "asLeftStatus" "ConditionStatus",
    "finalStatus" "FinalStatus",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EnvironmentalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceStandard" (
    "id" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calDue" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReferenceStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationStandardUsage" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CalibrationStandardUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "comments" TEXT,
    "flaggedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "fieldRef" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "originalValueJson" JSONB NOT NULL,
    "correctedValueJson" JSONB,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "correctedByUserId" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentFamily" "DocumentFamily" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordTemplateRevision" (
    "id" TEXT NOT NULL,
    "wordTemplateId" TEXT NOT NULL,
    "procedureId" TEXT,
    "revision" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "WordTemplateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordFieldMapping" (
    "id" TEXT NOT NULL,
    "wordTemplateRevisionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "placeholderTag" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WordFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "wordTemplateRevisionId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "failureMessage" TEXT,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationControlSync" (
    "id" TEXT NOT NULL,
    "calibrationRecordId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'QUEUED',
    "ccRecordId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "CalibrationControlSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "CustomerSite_customerId_idx" ON "CustomerSite"("customerId");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_ccAssetId_key" ON "EquipmentAsset"("ccAssetId");

-- CreateIndex
CREATE INDEX "EquipmentAsset_siteId_idx" ON "EquipmentAsset"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentAsset_customerId_assetNumber_key" ON "EquipmentAsset"("customerId", "assetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalFormTemplateRevision_digitalFormTemplateId_revision_key" ON "DigitalFormTemplateRevision"("digitalFormTemplateId", "revision");

-- CreateIndex
CREATE INDEX "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

-- CreateIndex
CREATE INDEX "WorkOrder_scheduledDate_idx" ON "WorkOrder"("scheduledDate");

-- CreateIndex
CREATE INDEX "CalibrationTask_assignedTechnicianId_idx" ON "CalibrationTask"("assignedTechnicianId");

-- CreateIndex
CREATE INDEX "CalibrationTask_assetId_idx" ON "CalibrationTask"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationRecord_taskId_key" ON "CalibrationRecord"("taskId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_assetId_idx" ON "CalibrationRecord"("assetId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_technicianId_idx" ON "CalibrationRecord"("technicianId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_status_idx" ON "CalibrationRecord"("status");

-- CreateIndex
CREATE INDEX "CalibrationRecordRevision_calibrationRecordId_idx" ON "CalibrationRecordRevision"("calibrationRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationRecordRevision_calibrationRecordId_revisionNumbe_key" ON "CalibrationRecordRevision"("calibrationRecordId", "revisionNumber");

-- CreateIndex
CREATE INDEX "MeasurementSection_calibrationRecordId_idx" ON "MeasurementSection"("calibrationRecordId");

-- CreateIndex
CREATE INDEX "MeasurementGroup_sectionId_idx" ON "MeasurementGroup"("sectionId");

-- CreateIndex
CREATE INDEX "MeasurementGroup_parentGroupId_idx" ON "MeasurementGroup"("parentGroupId");

-- CreateIndex
CREATE INDEX "MeasurementPoint_groupId_idx" ON "MeasurementPoint"("groupId");

-- CreateIndex
CREATE INDEX "PMChecklistSection_calibrationRecordId_idx" ON "PMChecklistSection"("calibrationRecordId");

-- CreateIndex
CREATE INDEX "PMChecklistItem_sectionId_idx" ON "PMChecklistItem"("sectionId");

-- CreateIndex
CREATE INDEX "EnvironmentalObservation_calibrationRecordId_idx" ON "EnvironmentalObservation"("calibrationRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceStandard_idNumber_key" ON "ReferenceStandard"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationStandardUsage_calibrationRecordId_standardId_key" ON "CalibrationStandardUsage"("calibrationRecordId", "standardId");

-- CreateIndex
CREATE INDEX "Review_calibrationRecordId_idx" ON "Review"("calibrationRecordId");

-- CreateIndex
CREATE INDEX "Correction_calibrationRecordId_idx" ON "Correction"("calibrationRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_calibrationRecordId_key" ON "Approval"("calibrationRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "WordTemplateRevision_wordTemplateId_revision_key" ON "WordTemplateRevision"("wordTemplateId", "revision");

-- CreateIndex
CREATE INDEX "WordFieldMapping_wordTemplateRevisionId_idx" ON "WordFieldMapping"("wordTemplateRevisionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_calibrationRecordId_idx" ON "GeneratedDocument"("calibrationRecordId");

-- CreateIndex
CREATE INDEX "CalibrationControlSync_calibrationRecordId_idx" ON "CalibrationControlSync"("calibrationRecordId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSite" ADD CONSTRAINT "CustomerSite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAsset" ADD CONSTRAINT "EquipmentAsset_defaultProcedureId_fkey" FOREIGN KEY ("defaultProcedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_digitalFormTemplateRevisionId_fkey" FOREIGN KEY ("digitalFormTemplateRevisionId") REFERENCES "DigitalFormTemplateRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_outputWordTemplateRevisionId_fkey" FOREIGN KEY ("outputWordTemplateRevisionId") REFERENCES "WordTemplateRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalFormTemplateRevision" ADD CONSTRAINT "DigitalFormTemplateRevision_digitalFormTemplateId_fkey" FOREIGN KEY ("digitalFormTemplateId") REFERENCES "DigitalFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CustomerSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTask" ADD CONSTRAINT "CalibrationTask_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTask" ADD CONSTRAINT "CalibrationTask_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTask" ADD CONSTRAINT "CalibrationTask_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTask" ADD CONSTRAINT "CalibrationTask_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CalibrationTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecord" ADD CONSTRAINT "CalibrationRecord_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationRecordRevision" ADD CONSTRAINT "CalibrationRecordRevision_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSection" ADD CONSTRAINT "MeasurementSection_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementGroup" ADD CONSTRAINT "MeasurementGroup_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MeasurementSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementGroup" ADD CONSTRAINT "MeasurementGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "MeasurementGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementPoint" ADD CONSTRAINT "MeasurementPoint_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MeasurementGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMChecklistSection" ADD CONSTRAINT "PMChecklistSection_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PMChecklistItem" ADD CONSTRAINT "PMChecklistItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PMChecklistSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalObservation" ADD CONSTRAINT "EnvironmentalObservation_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationStandardUsage" ADD CONSTRAINT "CalibrationStandardUsage_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationStandardUsage" ADD CONSTRAINT "CalibrationStandardUsage_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "ReferenceStandard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correction" ADD CONSTRAINT "Correction_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordTemplateRevision" ADD CONSTRAINT "WordTemplateRevision_wordTemplateId_fkey" FOREIGN KEY ("wordTemplateId") REFERENCES "WordTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordTemplateRevision" ADD CONSTRAINT "WordTemplateRevision_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordTemplateRevision" ADD CONSTRAINT "WordTemplateRevision_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordFieldMapping" ADD CONSTRAINT "WordFieldMapping_wordTemplateRevisionId_fkey" FOREIGN KEY ("wordTemplateRevisionId") REFERENCES "WordTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_wordTemplateRevisionId_fkey" FOREIGN KEY ("wordTemplateRevisionId") REFERENCES "WordTemplateRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationControlSync" ADD CONSTRAINT "CalibrationControlSync_calibrationRecordId_fkey" FOREIGN KEY ("calibrationRecordId") REFERENCES "CalibrationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationControlSync" ADD CONSTRAINT "CalibrationControlSync_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
