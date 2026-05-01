-- CreateTable
CREATE TABLE "custody_deal_projections" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lifecyclePhase" TEXT NOT NULL,
    "governingDocumentHash" TEXT,
    "openBlockersJson" JSONB NOT NULL DEFAULT '[]',
    "lastEventId" TEXT,
    "lastQldbDocumentId" TEXT,
    "lastDigestTipBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custody_deal_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_ledger_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "metadataJson" JSONB NOT NULL,
    "qldbDocumentId" TEXT,
    "digestTipBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custody_deal_projections_transactionId_key" ON "custody_deal_projections"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "custody_ledger_events_eventId_key" ON "custody_ledger_events"("eventId");

-- CreateIndex
CREATE INDEX "custody_ledger_events_transactionId_createdAt_idx" ON "custody_ledger_events"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "custody_deal_projections" ADD CONSTRAINT "custody_deal_projections_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_ledger_events" ADD CONSTRAINT "custody_ledger_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
