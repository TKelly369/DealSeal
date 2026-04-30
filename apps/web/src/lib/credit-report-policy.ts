import type { DocumentType, UserRole } from "@/generated/prisma";
import { parseLenderRuleProfile } from "@/lib/server/deal-access-control";

export function isCreditReportDocument(doc: { documentType: DocumentType | null; valuesSnapshot: unknown }): boolean {
  if (doc.documentType === "CREDIT_REPORT_UPLOAD") return true;
  const vs = doc.valuesSnapshot;
  if (vs && typeof vs === "object" && (vs as Record<string, unknown>).dealerUploadCategory === "CREDIT_REPORT") {
    return true;
  }
  return false;
}

/** Lender may open inline / “view” custodial URL (audit as VIEW). Default: allowed. */
export function lenderCreditReportViewAllowed(lenderRuleProfile: unknown): boolean {
  const p = parseLenderRuleProfile(lenderRuleProfile);
  if (p.allowLenderCreditReportView === false) return false;
  return true;
}

/** Lender may download binary (audit as DOWNLOAD). Default: allowed. */
export function lenderCreditReportDownloadAllowed(lenderRuleProfile: unknown): boolean {
  const p = parseLenderRuleProfile(lenderRuleProfile);
  if (p.allowLenderCreditReportDownload === false) return false;
  return true;
}

const LENDER_ACTOR_ROLES: UserRole[] = ["LENDER_USER", "LENDER_MANAGER"];

export function isLenderStaffSessionRole(role: UserRole): boolean {
  return LENDER_ACTOR_ROLES.includes(role);
}
