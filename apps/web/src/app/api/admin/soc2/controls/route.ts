import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTrustAdmin, requireTrustReader } from "@/lib/server/trust-auth";
import { TrustComplianceService } from "@/lib/services/trust-compliance.service";

type RequestBody = {
  action: string;
  payload?: Record<string, unknown>;
};

export async function GET(req: Request) {
  const user = await requireTrustReader();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "readiness";

  if (view === "audit_logs") {
    const rows = await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 300 });
    return NextResponse.json({ items: rows });
  }

  const [reports, incidents, vulnerabilities, pendingEvidence] = await Promise.all([
    prisma.sOC2ReadinessReport.findMany({ orderBy: { reportDate: "desc" }, take: 200 }),
    prisma.securityIncident.findMany({ where: { status: { not: "closed" } }, orderBy: { detectedAt: "desc" }, take: 100 }),
    prisma.vulnerabilityFinding.findMany({
      where: { status: { in: ["open", "accepted_risk"] } },
      orderBy: { detectedAt: "desc" },
      take: 100,
    }),
    prisma.complianceEvidence.findMany({
      where: { status: { in: ["pending", "needs_update", "expired"] } },
      orderBy: { uploadDate: "desc" },
      take: 200,
    }),
  ]);
  return NextResponse.json({ reports, incidents, vulnerabilities, pendingEvidence });
}

export async function POST(req: Request) {
  const user = await requireTrustAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as RequestBody;
  const action = body.action;
  const p = body.payload ?? {};

  if (action === "create_policy") {
    const row = await prisma.securityPolicy.create({
      data: {
        policyKey: String(p.policyKey ?? "").trim(),
        title: String(p.title ?? "").trim(),
        ownerUserId: user.id,
        nextReviewAt: p.nextReviewAt ? new Date(String(p.nextReviewAt)) : null,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "approve_policy") {
    const row = await prisma.policyVersion.update({
      where: { id: String(p.policyVersionId) },
      data: { status: "approved", approvedByUserId: user.id, approvedAt: new Date(), effectiveAt: new Date() },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "acknowledge_policy") {
    const row = await prisma.policyAcknowledgment.upsert({
      where: {
        policyVersionId_userId: {
          policyVersionId: String(p.policyVersionId),
          userId: String(p.userId ?? user.id),
        },
      },
      create: {
        policyVersionId: String(p.policyVersionId),
        userId: String(p.userId ?? user.id),
        role: user.role,
      },
      update: { acknowledgedAt: new Date() },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "upload_compliance_evidence") {
    const row = await prisma.complianceEvidence.create({
      data: {
        evidenceName: String(p.evidenceName ?? "").trim(),
        controlCategory: String(p.controlCategory ?? "").trim(),
        controlOwnerUserId: String(p.controlOwnerUserId ?? user.id),
        soc2Criterion: String(p.soc2Criterion ?? "").trim(),
        fileHash: String(p.fileHash ?? "").trim(),
        storageKey: p.storageKey ? String(p.storageKey) : null,
        expirationDate: p.expirationDate ? new Date(String(p.expirationDate)) : null,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "review_evidence") {
    const row = await prisma.complianceEvidence.update({
      where: { id: String(p.evidenceId) },
      data: { status: String(p.status) as "approved" | "pending" | "expired" | "needs_update", reviewDate: new Date(), reviewerUserId: user.id },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "create_vendor_risk_record") {
    const row = await prisma.vendorRiskRecord.create({
      data: {
        vendorName: String(p.vendorName ?? ""),
        serviceProvided: String(p.serviceProvided ?? ""),
        dataAccessed: String(p.dataAccessed ?? ""),
        riskLevel: String(p.riskLevel ?? "medium"),
        contractStatus: String(p.contractStatus ?? "active"),
        dpaStatus: String(p.dpaStatus ?? "pending"),
        soc2ReportStatus: String(p.soc2ReportStatus ?? "unknown"),
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "approve_vendor") {
    const row = await prisma.vendorRiskRecord.update({
      where: { id: String(p.vendorId) },
      data: { approved: true, reviewNotes: String(p.reviewNotes ?? "Approved by security/compliance.") },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "create_security_incident") {
    const row = await prisma.securityIncident.create({
      data: {
        incidentType: String(p.incidentType ?? "security_event"),
        severity: String(p.severity ?? "medium") as "low" | "medium" | "high" | "critical",
        title: String(p.title ?? "Security incident"),
        description: String(p.description ?? ""),
        ownerUserId: String(p.ownerUserId ?? user.id),
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "update_incident_status") {
    const row = await prisma.securityIncident.update({
      where: { id: String(p.incidentId) },
      data: {
        status: String(p.status) as
          | "detected"
          | "triaged"
          | "contained"
          | "investigating"
          | "remediation"
          | "monitoring"
          | "closed",
        resolvedAt: String(p.status) === "closed" ? new Date() : null,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "create_change_request") {
    const row = await prisma.changeRequest.create({
      data: {
        title: String(p.title ?? ""),
        description: String(p.description ?? ""),
        riskRating: String(p.riskRating ?? "medium"),
        affectedServices: String(p.affectedServices ?? "web"),
        rollbackPlan: String(p.rollbackPlan ?? ""),
        status: "pending_approval",
        changeOwnerUserId: user.id,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "approve_change_request") {
    const row = await prisma.changeRequest.update({
      where: { id: String(p.changeRequestId) },
      data: { status: "approved", approvalUserId: user.id, approvalTimestamp: new Date() },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "record_deployment") {
    const row = await prisma.deploymentRecord.create({
      data: {
        changeRequestId: p.changeRequestId ? String(p.changeRequestId) : null,
        environment: String(p.environment ?? "production"),
        actorUserId: user.id,
        commitSha: p.commitSha ? String(p.commitSha) : null,
        serviceName: String(p.serviceName ?? "web"),
        verificationStatus: String(p.verificationStatus ?? "pending"),
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "run_access_review") {
    const row = await prisma.accessReview.create({
      data: {
        quarterLabel: String(p.quarterLabel ?? "Q1"),
        scopeSummary: String(p.scopeSummary ?? "Dealer, lender, support, admin, API keys, service accounts."),
        reviewerUserId: user.id,
        status: "in_review",
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "complete_access_review") {
    const row = await prisma.accessReview.update({
      where: { id: String(p.accessReviewId) },
      data: { status: "completed", completedAt: new Date(), notes: String(p.notes ?? "") },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "generate_soc2_readiness_report") {
    const rows = await TrustComplianceService.generateSoc2ReadinessSummary(user.id);
    return NextResponse.json({ items: rows });
  }

  if (action === "create_privacy_request") {
    const row = await prisma.privacyRequest.create({
      data: {
        requestType: String(p.requestType ?? "access"),
        requestorEmail: String(p.requestorEmail ?? ""),
        organizationId: p.organizationId ? String(p.organizationId) : null,
        subjectReference: p.subjectReference ? String(p.subjectReference) : null,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "verify_backup_test") {
    const row = await prisma.backupVerification.create({
      data: {
        environment: String(p.environment ?? "production"),
        backupType: String(p.backupType ?? "database_snapshot"),
        rtoMinutes: Number(p.rtoMinutes ?? 0) || null,
        rpoMinutes: Number(p.rpoMinutes ?? 0) || null,
        passed: Boolean(p.passed ?? true),
        details: p.details ? String(p.details) : null,
        verifiedByUserId: user.id,
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "record_vulnerability_finding") {
    const row = await prisma.vulnerabilityFinding.create({
      data: {
        source: String(p.source ?? "dependency_scan"),
        findingTitle: String(p.findingTitle ?? ""),
        severity: String(p.severity ?? "medium"),
      },
    });
    return NextResponse.json({ item: row });
  }

  if (action === "close_vulnerability_finding") {
    const row = await prisma.vulnerabilityFinding.update({
      where: { id: String(p.vulnerabilityId) },
      data: { status: "closed", remediatedAt: new Date(), notes: String(p.notes ?? "") },
    });
    return NextResponse.json({ item: row });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
