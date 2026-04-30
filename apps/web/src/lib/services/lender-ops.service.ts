import { prisma } from "@/lib/db";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";
import type {
  DealComplianceStatus,
  LenderTaskCategory,
  LenderTaskPriority,
  LenderTaskStatus,
  MissingItemRequestStatus,
} from "@/generated/prisma";

export type EnforcementReadinessResult = {
  status: "Enforcement Ready" | "Enforcement Warning" | "Enforcement Blocked";
  score: number;
  checks: Array<{ key: string; label: string; ok: boolean; blocking: boolean }>;
};

export type LenderCommandCenterCounts = {
  newDealerSubmissions: number;
  dealsPendingReview: number;
  dealsReadyForFunding: number;
  missingDealerItems: number;
  postFundingFollowUps: number;
  enforcementWarnings: number;
  poolingReadyDeals: number;
  secondaryMarketAlerts: number;
};

export type AlertRecord = {
  id: string;
  lenderId: string;
  dealId?: string | null;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  createdAt: Date;
  resolvedAt?: Date | null;
};

const DEFAULT_COUNTS: LenderCommandCenterCounts = {
  newDealerSubmissions: 0,
  dealsPendingReview: 0,
  dealsReadyForFunding: 0,
  missingDealerItems: 0,
  postFundingFollowUps: 0,
  enforcementWarnings: 0,
  poolingReadyDeals: 0,
  secondaryMarketAlerts: 0,
};

function trafficLightFromCompliance(
  status: DealComplianceStatus,
): "Green" | "Yellow" | "Red" {
  if (status === "BLOCKED") return "Red";
  if (status === "WARNING") return "Yellow";
  return "Green";
}

export const LenderOpsService = {
  trafficLightFromCompliance,

  async getCommandCenterCounts(lenderId: string): Promise<LenderCommandCenterCounts> {
    try {
      const [
        newDealerSubmissions,
        dealsPendingReview,
        dealsReadyForFunding,
        missingDealerItems,
        postFundingFollowUps,
        enforcementWarnings,
        poolingReadyDeals,
        secondaryMarketAlerts,
      ] = await Promise.all([
        prisma.deal.count({
          where: { lenderId, createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
        }),
        prisma.deal.count({
          where: { lenderId, status: { in: ["LENDER_REVIEW", "RISC_UNSIGNED_REVIEW", "RISC_LENDER_FINAL"] } },
        }),
        prisma.deal.count({
          where: {
            lenderId,
            status: { in: ["LENDER_FINAL_APPROVAL", "AWAITING_FUNDING_UPLOAD", "CLOSING_PACKAGE_READY"] },
          },
        }),
        prisma.missingItemRequest.count({
          where: { lenderId, status: { in: ["requested", "uploaded", "overdue"] } },
        }),
        prisma.lenderTask.count({
          where: { lenderId, category: "post_funding", status: { in: ["open", "in_progress", "overdue"] } },
        }),
        prisma.lenderTask.count({
          where: { lenderId, category: "enforcement_readiness", status: { in: ["open", "blocked", "overdue"] } },
        }),
        prisma.deal.count({
          where: {
            lenderId,
            status: { in: ["FUNDED", "CONSUMMATED"] },
            complianceStatus: { in: ["COMPLIANT", "WARNING"] },
            poolId: null,
          },
        }),
        prisma.loanPool.count({
          where: { lenderId, status: { in: ["DRAFT", "READY_FOR_SALE"] }, poolIntegrityStatus: { not: "COMPLIANT" } },
        }),
      ]);
      return {
        newDealerSubmissions,
        dealsPendingReview,
        dealsReadyForFunding,
        missingDealerItems,
        postFundingFollowUps,
        enforcementWarnings,
        poolingReadyDeals,
        secondaryMarketAlerts,
      };
    } catch {
      return DEFAULT_COUNTS;
    }
  },

  async listTasks(lenderId: string) {
    try {
      return await prisma.lenderTask.findMany({
        where: { lenderId },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
    } catch {
      return [];
    }
  },

  async listAlerts(lenderId: string) {
    try {
      const [dealAlerts, missingItems] = await Promise.all([
        prisma.dealAlert.findMany({
          where: { deal: { lenderId } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.missingItemRequest.findMany({
          where: { lenderId, status: { in: ["requested", "uploaded", "overdue"] } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
      const mappedMissing = missingItems.map((m) => ({
        id: `missing-${m.id}`,
        title: `Missing dealer item: ${m.requestedItemType}`,
        message: m.description ?? "Dealer item request requires review.",
        severity: m.priority === "critical" ? "CRITICAL" : m.priority === "high" ? "WARNING" : "INFO",
        status: m.status === "accepted" ? "RESOLVED" : "OPEN",
        createdAt: m.createdAt,
        resolvedAt: m.resolvedAt,
        dealId: m.dealId,
      }));
      return [...dealAlerts, ...mappedMissing];
    } catch {
      return [];
    }
  },

  async evaluateEnforcementReadiness(dealId: string, lenderId: string): Promise<EnforcementReadinessResult> {
    const checks = [
      { key: "governingCopy", label: "Governing copy identified", ok: false, blocking: true },
      { key: "authoritative", label: "Authoritative contract rendered", ok: false, blocking: true },
      { key: "contractLocked", label: "Contract locked", ok: false, blocking: true },
      { key: "signatureRecords", label: "Signature records present", ok: false, blocking: true },
      { key: "assignmentTrail", label: "Assignment/control trail complete", ok: false, blocking: true },
      { key: "titleLien", label: "Title/lien docs present where applicable", ok: false, blocking: false },
      { key: "requiredDisclosures", label: "Required disclosures present", ok: false, blocking: true },
      { key: "validationCert", label: "Funding validation certificate exists", ok: false, blocking: false },
      { key: "auditTrail", label: "Audit trail complete", ok: false, blocking: true },
      { key: "custodyRecord", label: "Custody record complete", ok: false, blocking: true },
      { key: "contractConflicts", label: "No conflicting contract versions", ok: false, blocking: true },
      { key: "redCompliance", label: "No unresolved red-light compliance issues", ok: false, blocking: true },
    ];
    try {
      const deal = await prisma.deal.findFirst({
        where: { id: dealId, lenderId },
        include: {
          authoritativeContract: true,
          generatedDocuments: true,
          contractTransactionEvents: true,
          prefundingValidationCertificate: true,
          auditEvents: true,
          custodyEvents: true,
          complianceChecks: true,
        },
      });
      if (!deal) {
        return { status: "Enforcement Blocked", score: 0, checks };
      }

      const set = (key: string, ok: boolean) => {
        const target = checks.find((c) => c.key === key);
        if (target) target.ok = ok;
      };
      set("governingCopy", !!deal.authoritativeContract);
      set("authoritative", !!deal.authoritativeContract?.authoritativeContractHash);
      set("contractLocked", deal.status === "AUTHORITATIVE_LOCK" || deal.status === "FUNDED" || deal.status === "CONSUMMATED" || deal.status === "CLOSING_PACKAGE_READY" || deal.status === "AWAITING_FUNDING_UPLOAD");
      set("signatureRecords", deal.generatedDocuments.some((d) => d.documentType === "RISC_SIGNED"));
      set("assignmentTrail", deal.contractTransactionEvents.length > 0);
      set("titleLien", deal.generatedDocuments.some((d) => d.documentType === "BMV_LIEN_CERT" || d.documentType === "UCSP_TITLE_APPLICATION"));
      set("requiredDisclosures", deal.generatedDocuments.some((d) => d.documentType?.includes("DISCLOSURE")));
      set("validationCert", !!deal.prefundingValidationCertificate);
      set("auditTrail", deal.auditEvents.length > 0);
      set("custodyRecord", deal.custodyEvents.length > 0);
      const contractDocs = deal.generatedDocuments.filter((d) => d.documentType === "RISC_SIGNED" || d.documentType === "RISC_LENDER_FINAL");
      set("contractConflicts", contractDocs.length <= 3);
      set("redCompliance", !deal.complianceChecks.some((c) => c.status === "BLOCKED"));

      const passed = checks.filter((c) => c.ok).length;
      const blockingFailures = checks.filter((c) => c.blocking && !c.ok).length;
      const score = Math.round((passed / checks.length) * 100);
      const status =
        blockingFailures > 0 ? "Enforcement Blocked" : score >= 85 ? "Enforcement Ready" : "Enforcement Warning";
      return { status, score, checks };
    } catch {
      return { status: "Enforcement Warning", score: 50, checks };
    }
  },

  async requestMissingItem(input: {
    lenderId: string;
    dealerId: string;
    dealId: string;
    requestedItemType: string;
    description?: string;
    required?: boolean;
    priority?: LenderTaskPriority;
    dueDate?: Date;
    requestedBy: string;
  }) {
    const created = await prisma.missingItemRequest.create({
      data: {
        lenderId: input.lenderId,
        dealerId: input.dealerId,
        dealId: input.dealId,
        requestedItemType: input.requestedItemType,
        description: input.description,
        required: input.required ?? true,
        priority: input.priority ?? "medium",
        dueDate: input.dueDate,
        requestedBy: input.requestedBy,
      },
    });
    await prisma.dealAlert.create({
      data: {
        workspaceId: input.dealerId,
        dealId: input.dealId,
        type: "MISSING_DEALER_ITEM_REQUESTED",
        severity: input.priority === "critical" ? "CRITICAL" : "WARNING",
        title: `Missing item requested: ${input.requestedItemType}`,
        message: input.description ?? "Lender requested a missing item.",
        status: "OPEN",
      },
    });
    await recordDealAuditEvent({
      dealId: input.dealId,
      workspaceId: input.lenderId,
      actorUserId: input.requestedBy,
      authMethod: "SESSION",
      action: "LENDER_MISSING_ITEM_REQUESTED",
      entityType: "MissingItemRequest",
      entityId: created.id,
      payload: {
        requestedItemType: input.requestedItemType,
        priority: input.priority ?? "medium",
        dueDate: input.dueDate?.toISOString() ?? null,
      },
    });
    return created;
  },

  async updateTaskStatus(input: { taskId: string; lenderId: string; status: LenderTaskStatus }) {
    await prisma.lenderTask.updateMany({
      where: { id: input.taskId, lenderId: input.lenderId },
      data: {
        status: input.status,
        completedAt: input.status === "completed" ? new Date() : null,
      },
    });
  },

  async createTask(input: {
    lenderId: string;
    dealId?: string;
    dealerId?: string;
    poolId?: string;
    title: string;
    description?: string;
    category: LenderTaskCategory;
    priority?: LenderTaskPriority;
    dueDate?: Date;
    assignedTo?: string;
    source?: string;
    auditEventId?: string;
  }) {
    return prisma.lenderTask.create({
      data: {
        lenderId: input.lenderId,
        dealId: input.dealId,
        dealerId: input.dealerId,
        poolId: input.poolId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority ?? "medium",
        dueDate: input.dueDate,
        assignedTo: input.assignedTo,
        source: input.source,
        auditEventId: input.auditEventId,
      },
    });
  },

  async listMissingItemRequests(lenderId: string) {
    try {
      return await prisma.missingItemRequest.findMany({
        where: { lenderId },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
    } catch {
      return [];
    }
  },

  async updateMissingItemStatus(input: { requestId: string; lenderId: string; status: MissingItemRequestStatus }) {
    const existing = await prisma.missingItemRequest.findFirst({
      where: { id: input.requestId, lenderId: input.lenderId },
    });
    if (!existing) return;
    await prisma.missingItemRequest.updateMany({
      where: { id: input.requestId, lenderId: input.lenderId },
      data: {
        status: input.status,
        lenderReviewStatus: input.status === "accepted" ? "accepted" : input.status === "rejected" ? "rejected" : "pending",
        resolvedAt: input.status === "accepted" ? new Date() : null,
      },
    });
    await recordDealAuditEvent({
      dealId: existing.dealId,
      workspaceId: input.lenderId,
      authMethod: "SESSION",
      action: `LENDER_MISSING_ITEM_${input.status.toUpperCase()}`,
      entityType: "MissingItemRequest",
      entityId: existing.id,
      payload: { status: input.status },
    });
  },
};
