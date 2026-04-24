-- Governing record architecture: authoritative record, rendering events, and audit log.

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'EXECUTED', 'LOCKED', 'VOIDED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RenderingMode" AS ENUM ('CERTIFIED', 'CONVENIENCE');

-- CreateTable
CREATE TABLE "governing_records" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "recordDataJson" JSONB NOT NULL,
    "signaturesJson" JSONB NOT NULL DEFAULT '{}',
    "controlAssignmentJson" JSONB NOT NULL DEFAULT '{}',
    "versionAuditJson" JSONB NOT NULL DEFAULT '[]',
    "recordHashSha256" TEXT NOT NULL,
    "sealedStorageKey" TEXT,
    "executedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendering_events" (
    "id" TEXT NOT NULL,
    "governingRecordId" TEXT NOT NULL,
    "governingVersion" INTEGER NOT NULL,
    "mode" "RenderingMode" NOT NULL,
    "baseBodyHashSha256" TEXT NOT NULL,
    "renderingHashSha256" TEXT NOT NULL,
    "outputMimeType" TEXT NOT NULL,
    "outputStorageKey" TEXT,
    "qrVerifyUrl" TEXT NOT NULL,
    "recordHashAtRender" TEXT NOT NULL,
    "facsimileTimestamp" TIMESTAMP(3) NOT NULL,
    "attestationText" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "clientMetadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rendering_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governing_record_audit_log" (
    "id" TEXT NOT NULL,
    "governingRecordId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "actorUserId" TEXT,
    "requestMetadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governing_record_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governing_records_publicRef_key" ON "governing_records"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "governing_records_transactionId_key" ON "governing_records"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "governing_records_supersededById_key" ON "governing_records"("supersededById");

-- CreateIndex
CREATE INDEX "governing_records_orgId_status_idx" ON "governing_records"("orgId", "status");

-- CreateIndex
CREATE INDEX "governing_records_publicRef_idx" ON "governing_records"("publicRef");

-- CreateIndex
CREATE INDEX "rendering_events_governingRecordId_createdAt_idx" ON "rendering_events"("governingRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "governing_record_audit_log_governingRecordId_createdAt_idx" ON "governing_record_audit_log"("governingRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "governing_record_audit_log_eventKind_createdAt_idx" ON "governing_record_audit_log"("eventKind", "createdAt");

-- AddForeignKey
ALTER TABLE "governing_records" ADD CONSTRAINT "governing_records_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governing_records" ADD CONSTRAINT "governing_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governing_records" ADD CONSTRAINT "governing_records_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "governing_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendering_events" ADD CONSTRAINT "rendering_events_governingRecordId_fkey" FOREIGN KEY ("governingRecordId") REFERENCES "governing_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendering_events" ADD CONSTRAINT "rendering_events_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governing_record_audit_log" ADD CONSTRAINT "governing_record_audit_log_governingRecordId_fkey" FOREIGN KEY ("governingRecordId") REFERENCES "governing_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governing_record_audit_log" ADD CONSTRAINT "governing_record_audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
