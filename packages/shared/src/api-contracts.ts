import type { TransactionState } from "./transaction-states.js";
import type { UserRole } from "./roles.js";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  roles: UserRole[];
}

export interface TransactionSummaryDto {
  id: string;
  publicId: string;
  state: TransactionState;
  governingAgreementId: string | null;
  updatedAt: string;
}

export interface PricingPreviewLine {
  eventType: string;
  quantity: number;
  unitAmountUsd: number;
  lineTotalUsd: number;
  metadata?: Record<string, string>;
}

export interface PricingPreviewDto {
  currency: "usd";
  lines: PricingPreviewLine[];
  subtotalUsd: number;
}
