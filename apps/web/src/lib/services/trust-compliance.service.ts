import crypto from "crypto";
import { prisma } from "@/lib/db";

export const TrustComplianceService = {
  async recordAuditLog(input: {
    eventType: string;
    userId?: string;
    role?: string;
    organizationId?: string;
    ipAddress?: string;
    userAgent?: string;
    affectedRecordType?: string;
    affectedRecordId?: string;
    previousValue?: unknown;
    newValue?: unknown;
    documentHash?: string;
    systemStatus?: string;
    immutableLogRef?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        eventId: crypto.randomUUID(),
        eventType: input.eventType,
        userId: input.userId,
        role: input.role,
        organizationId: input.organizationId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        affectedRecordType: input.affectedRecordType,
        affectedRecordId: input.affectedRecordId,
        previousValue: (input.previousValue as object | undefined) ?? undefined,
        newValue: (input.newValue as object | undefined) ?? undefined,
        documentHash: input.documentHash,
        systemStatus: input.systemStatus,
        immutableLogRef: input.immutableLogRef,
        metadata: (input.metadata as object | undefined) ?? {},
      },
    });
  },

  async generateSoc2ReadinessSummary(generatedByUserId?: string) {
    const [evidence, incidents, vulnerabilities, exceptions] = await Promise.all([
      prisma.complianceEvidence.groupBy({
        by: ["controlCategory", "status"],
        _count: { _all: true },
      }),
      prisma.securityIncident.count({
        where: { status: { not: "closed" } },
      }),
      prisma.vulnerabilityFinding.count({
        where: { status: { in: ["open", "accepted_risk"] } },
      }),
      prisma.complianceException.count({
        where: { status: "open" },
      }),
    ]);

    const categories = Array.from(new Set(evidence.map((e) => e.controlCategory)));
    const created = await Promise.all(
      categories.map(async (category) => {
        const rows = evidence.filter((e) => e.controlCategory === category);
        const approved = rows.find((r) => r.status === "approved")?._count._all ?? 0;
        const pending = rows.find((r) => r.status === "pending")?._count._all ?? 0;
        const needsUpdate = rows.find((r) => r.status === "needs_update")?._count._all ?? 0;
        const score = Math.max(0, Math.min(100, Math.round((approved / Math.max(approved + pending + needsUpdate, 1)) * 100)));
        return prisma.sOC2ReadinessReport.create({
          data: {
            controlCategory: category,
            controlDescription: `SOC 2 control coverage for ${category}`,
            evidenceStatus: pending > 0 || needsUpdate > 0 ? "attention_required" : "ready",
            exceptionsSummary: `${exceptions} open exceptions, ${incidents} open incidents, ${vulnerabilities} open vulnerabilities`,
            remediationStatus: pending > 0 || needsUpdate > 0 ? "in_progress" : "on_track",
            readinessScore: score,
            generatedByUserId,
          },
        });
      }),
    );
    return created;
  },
};
