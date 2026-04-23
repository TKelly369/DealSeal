import { describe, expect, it } from "vitest";
import { normalizeTimelineItems } from "../src/services/audit-read-service.js";
import type { TimelineItem } from "../src/services/audit-query-service.js";

describe("normalizeTimelineItems", () => {
  it("maps audit rows to entityType / entityId from structured fields", () => {
    const items: TimelineItem[] = [
      {
        source: "audit",
        id: "a1",
        createdAt: "2026-01-01T00:00:00.000Z",
        data: {
          eventType: "PATCH_BUYER",
          action: "PATCH_BUYER",
          entityType: "BuyerProfile",
          entityId: "buyer-1",
          resource: "BuyerProfile",
          resourceId: "buyer-1",
          actorUserId: "u1",
        },
      },
    ];
    const out = normalizeTimelineItems(items);
    expect(out[0].entityType).toBe("BuyerProfile");
    expect(out[0].entityId).toBe("buyer-1");
    expect(out[0].actorUserId).toBe("u1");
  });

  it("falls back to legacy resource fields for audit", () => {
    const items: TimelineItem[] = [
      {
        source: "audit",
        id: "a2",
        createdAt: "2026-01-01T00:00:00.000Z",
        data: {
          eventType: "LEGACY",
          action: "LEGACY",
          resource: "Document",
          resourceId: "d1",
        },
      },
    ];
    const out = normalizeTimelineItems(items);
    expect(out[0].entityType).toBe("Document");
    expect(out[0].entityId).toBe("d1");
  });

  it("labels document channel as Document", () => {
    const items: TimelineItem[] = [
      {
        source: "document",
        id: "dv1",
        createdAt: "2026-01-01T00:00:00.000Z",
        data: { documentId: "doc-9", documentType: "CONTRACT", version: 1 },
      },
    ];
    const out = normalizeTimelineItems(items);
    expect(out[0].entityType).toBe("Document");
    expect(out[0].entityId).toBe("doc-9");
  });

  it("includes transactionId on state items for entityId", () => {
    const items: TimelineItem[] = [
      {
        source: "state",
        id: "st1",
        createdAt: "2026-01-01T00:00:00.000Z",
        data: {
          transactionId: "tx-1",
          fromState: "DRAFT",
          toState: "CONDITIONAL",
        },
      },
    ];
    const out = normalizeTimelineItems(items);
    expect(out[0].entityType).toBe("StateTransition");
    expect(out[0].entityId).toBe("tx-1");
  });
});
