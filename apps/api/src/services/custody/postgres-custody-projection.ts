import type { PrismaClient } from "@prisma/client";
import type { CustodyEvent, CustodyProjectionWriter, CustodyLedgerCommitHint } from "@dealseal/custody-ledger";
import { foldEvent, INITIAL_DEAL_AGGREGATE } from "@dealseal/custody-ledger";
import type { DealAggregate } from "@dealseal/custody-ledger";

export class PostgresCustodyProjectionWriter implements CustodyProjectionWriter {
  constructor(private readonly db: PrismaClient) {}

  async applyCustodyEvent(event: CustodyEvent, ledgerHint?: CustodyLedgerCommitHint): Promise<void> {
    const transactionId = event.metadata.deal_id;

    await this.db.$transaction(async (tx) => {
      const dup = await tx.custodyLedgerEvent.findUnique({
        where: { eventId: event.metadata.event_id },
      });
      if (dup) return;

      const aggRow = await tx.custodyDealProjection.findUnique({
        where: { transactionId },
      });

      const base: DealAggregate = aggRow
        ? {
            deal_id: transactionId,
            version: aggRow.version,
            lifecyclePhase: aggRow.lifecyclePhase as DealAggregate["lifecyclePhase"],
            governingDocumentHash: aggRow.governingDocumentHash,
            openBlockers: Array.isArray(aggRow.openBlockersJson)
              ? (aggRow.openBlockersJson as string[])
              : [],
          }
        : INITIAL_DEAL_AGGREGATE(transactionId);

      const next = foldEvent(base, event);

      await tx.custodyLedgerEvent.create({
        data: {
          eventId: event.metadata.event_id,
          transactionId,
          eventType: event.metadata.event_type,
          payloadJson: event.payload as object,
          metadataJson: { ...event.metadata } as object,
          qldbDocumentId: ledgerHint?.documentId ?? null,
          digestTipBase64: ledgerHint?.digestTipBase64 ?? null,
        },
      });

      await tx.custodyDealProjection.upsert({
        where: { transactionId },
        create: {
          transactionId,
          version: next.version,
          lifecyclePhase: next.lifecyclePhase,
          governingDocumentHash: next.governingDocumentHash,
          openBlockersJson: next.openBlockers,
          lastEventId: event.metadata.event_id,
          lastQldbDocumentId: ledgerHint?.documentId ?? null,
          lastDigestTipBase64: ledgerHint?.digestTipBase64 ?? null,
        },
        update: {
          version: next.version,
          lifecyclePhase: next.lifecyclePhase,
          governingDocumentHash: next.governingDocumentHash,
          openBlockersJson: next.openBlockers,
          lastEventId: event.metadata.event_id,
          lastQldbDocumentId: ledgerHint?.documentId ?? null,
          lastDigestTipBase64: ledgerHint?.digestTipBase64 ?? null,
        },
      });
    });
  }
}
