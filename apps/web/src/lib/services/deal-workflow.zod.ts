import { z } from "zod";

export const DealLifecycleStatusSchema = z.enum([
  "DISCLOSURE_REQUIRED",
  "AUTHORIZED_FOR_STRUCTURING",
  "GREEN_STAGE",
  "RISC_UNSIGNED_REVIEW",
  "RISC_LENDER_FINAL",
  "FIRST_GREEN_PASSED",
  "AUTHORITATIVE_LOCK",
  "GENERATING_CLOSING_PACKAGE",
  "CLOSING_PACKAGE_READY",
  "CONSUMMATED",
]);

export const GreenStageDocTypeSchema = z.enum(["DEALER_UPLOAD", "INSURANCE"]);

export type DealLifecycleStatus = z.infer<typeof DealLifecycleStatusSchema>;
