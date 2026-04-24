-- Align "AuditEvent" with prisma/schema when the DB was created from an older init that omitted
-- these columns. Safe for DBs that already have them: IF NOT EXISTS.
-- No data loss: only adds nullable or defaulted columns and indexes.

ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "resource" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "resourceId" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "payloadJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_transactionId_createdAt_idx" ON "AuditEvent"("transactionId", "createdAt");
