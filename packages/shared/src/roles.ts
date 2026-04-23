export const UserRoles = [
  "ADMIN",
  "DEALER_USER",
  "FINANCE_MANAGER",
  "COMPLIANCE_OFFICER",
  "AUDITOR",
] as const;

export type UserRole = (typeof UserRoles)[number];
