import type { PrismaClient } from "@prisma/client";
import type { DealAggregate, DealAggregateLoader } from "@dealseal/custody-ledger";

const PHASES = new Set<DealAggregate["lifecyclePhase"]>([
  "intake",
  "underwriting",
  "funding",
  "closed",
  "sold",
  "archived",
]);

function parseOpenBlockers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export class PostgresDealAggregateLoader implements DealAggregateLoader {
  constructor(private readonly db: PrismaClient) {}

  async loadByDealId(dealId: string): Promise<DealAggregate | null> {
    const row = await this.db.custodyDealProjection.findUnique({
      where: { transactionId: dealId },
    });
    if (!row) return null;

    const lifecyclePhase = PHASES.has(row.lifecyclePhase as DealAggregate["lifecyclePhase"])
      ? (row.lifecyclePhase as DealAggregate["lifecyclePhase"])
      : "intake";

    return {
      deal_id: dealId,
      version: row.version,
      lifecyclePhase,
      governingDocumentHash: row.governingDocumentHash,
      openBlockers: parseOpenBlockers(row.openBlockersJson),
    };
  }
}
