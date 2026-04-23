import type { TransactionState, UserRole } from "@prisma/client";

export type DealTransitionRow = {
  from: TransactionState;
  to: TransactionState;
  /** Empty = all authenticated org members (non-auditor). */
  roles: UserRole[] | "ALL";
  requireGoverning?: boolean;
};

/**
 * Authoritative allow-list. Invalid pairs are blocked with code INVALID_TRANSITION.
 * Legacy state names (CONDITIONAL, APPROVED, etc.) run in parallel to new “traffic light”
 * names until all rows are migrated in the database.
 */
export const DEAL_TRANSITIONS: DealTransitionRow[] = [
  { from: "DRAFT", to: "RED", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DRAFT", to: "INVALID", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DRAFT", to: "YELLOW", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DRAFT", to: "CONDITIONAL", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DRAFT", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DRAFT", to: "HOLD", roles: ["ADMIN", "COMPLIANCE_OFFICER"] },
  { from: "RED", to: "YELLOW", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "RED", to: "DRAFT", roles: "ALL" as const },
  { from: "INVALID", to: "DRAFT", roles: "ALL" as const },
  { from: "RED", to: "CONDITIONAL", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "INVALID", to: "CONDITIONAL", roles: ["DEALER_USER", "FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "YELLOW", to: "GREEN_STAGE_1", roles: ["FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "YELLOW", to: "APPROVED", roles: ["FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "CONDITIONAL", to: "GREEN_STAGE_1", roles: ["FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "CONDITIONAL", to: "APPROVED", roles: ["FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "YELLOW", to: "RED", roles: ["COMPLIANCE_OFFICER", "DEALER_USER", "FINANCE_MANAGER", "ADMIN"] },
  { from: "CONDITIONAL", to: "INVALID", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "GREEN_STAGE_1", to: "EXECUTED_PENDING_VERIFICATION", roles: ["FINANCE_MANAGER", "ADMIN"], requireGoverning: true },
  { from: "APPROVED", to: "EXECUTED", roles: ["FINANCE_MANAGER", "ADMIN"], requireGoverning: true },
  { from: "APPROVED", to: "EXECUTED_PENDING_VERIFICATION", roles: ["FINANCE_MANAGER", "ADMIN"], requireGoverning: true },
  { from: "GREEN_STAGE_1", to: "EXECUTED", roles: ["FINANCE_MANAGER", "ADMIN"], requireGoverning: true },
  { from: "EXECUTED", to: "LOCKED", roles: ["COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "EXECUTED_PENDING_VERIFICATION", to: "LOCKED", roles: ["COMPLIANCE_OFFICER", "ADMIN"], requireGoverning: true },
  { from: "EXECUTED", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "EXECUTED_PENDING_VERIFICATION", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "APPROVED", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "GREEN_STAGE_1", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "LOCKED", to: "POST_FUNDING_PENDING", roles: ["FINANCE_MANAGER", "COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "POST_FUNDING_PENDING", to: "COMPLETED", roles: ["COMPLIANCE_OFFICER", "FINANCE_MANAGER", "ADMIN"] },
  { from: "POST_FUNDING_PENDING", to: "GREEN_STAGE_2", roles: ["COMPLIANCE_OFFICER", "FINANCE_MANAGER", "ADMIN"] },
  { from: "COMPLETED", to: "GREEN_STAGE_2", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "GREEN_STAGE_2", to: "ARCHIVED", roles: ["ADMIN"] },
  { from: "COMPLETED", to: "ARCHIVED", roles: ["ADMIN"] },
  { from: "DRAFT", to: "ARCHIVED", roles: ["ADMIN"] },
  { from: "DISCREPANCY_RESTRICTED", to: "YELLOW", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "DISCREPANCY_RESTRICTED", to: "CONDITIONAL", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
  { from: "HOLD", to: "DRAFT", roles: ["ADMIN"] },
  { from: "ARCHIVED", to: "PURGED", roles: ["ADMIN"] },
  { from: "YELLOW", to: "HOLD", roles: ["ADMIN", "COMPLIANCE_OFFICER"] },
  { from: "APPROVED", to: "HOLD", roles: ["ADMIN", "COMPLIANCE_OFFICER"] },
  { from: "GREEN_STAGE_1", to: "HOLD", roles: ["ADMIN", "COMPLIANCE_OFFICER"] },
  { from: "YELLOW", to: "DISCREPANCY_RESTRICTED", roles: ["COMPLIANCE_OFFICER", "ADMIN"] },
];

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "DEALER_USER",
  "FINANCE_MANAGER",
  "COMPLIANCE_OFFICER",
  "AUDITOR",
];

function matchesRoles(
  def: (typeof DEAL_TRANSITIONS)[0],
  userRoles: UserRole[],
): boolean {
  if (def.roles === "ALL") {
    return userRoles.some((r) => r !== "AUDITOR");
  }
  return def.roles.some((r) => userRoles.includes(r));
}

export function findTransitionDef(
  from: TransactionState,
  to: TransactionState,
) {
  return DEAL_TRANSITIONS.find((d) => d.from === from && d.to === to);
}

export function roleCanUseTransition(
  from: TransactionState,
  to: TransactionState,
  userRoles: UserRole[],
) {
  const def = findTransitionDef(from, to);
  if (!def) return false;
  if (def.roles === "ALL") {
    return userRoles.some((r) => r !== "AUDITOR");
  }
  return (def.roles as UserRole[]).some((r) => userRoles.includes(r));
}

/** Distinct `to` targets reachable in one step from `from` (per config). */
export function candidateTargets(
  from: TransactionState,
): TransactionState[] {
  const s = new Set<TransactionState>();
  for (const t of DEAL_TRANSITIONS) {
    if (t.from === from) s.add(t.to);
  }
  return Array.from(s);
}

export function isRoleListAll(def: (typeof DEAL_TRANSITIONS)[0]) {
  return def.roles === "ALL";
}

export { ALL_ROLES };
