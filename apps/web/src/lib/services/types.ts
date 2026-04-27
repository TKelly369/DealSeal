import { z } from "zod";

export const DealBuilderSchema = z.object({
  dealerId: z.string(),
  lenderId: z.string(),
  dealerLenderLinkId: z.string(),
  state: z.string().min(2),
  party: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address: z.string().min(5),
    creditTier: z.string().optional(),
  }),
  vehicle: z.object({
    year: z.coerce.number().int().min(1980),
    make: z.string().min(1),
    model: z.string().min(1),
    vin: z.string().min(5),
    mileage: z.coerce.number().int().min(0),
    condition: z.enum(["NEW", "USED"]),
  }),
  financials: z.object({
    amountFinanced: z.coerce.number().min(0),
    ltv: z.coerce.number().min(0),
    maxLtv: z.coerce.number().min(0),
    taxes: z.coerce.number().min(0),
    fees: z.coerce.number().min(0),
    gap: z.coerce.number().min(0),
    warranty: z.coerce.number().min(0),
    totalSalePrice: z.coerce.number().min(0),
  }),
});

export const ComplianceResultSchema = z.object({
  status: z.enum(["COMPLIANT", "WARNING", "BLOCKED"]),
  checks: z.array(
    z.object({
      id: z.string(),
      ruleSet: z.enum(["STATE", "LENDER"]),
      status: z.enum(["COMPLIANT", "WARNING", "BLOCKED"]),
      affectedField: z.string().nullable(),
      explanation: z.string(),
      ruleSource: z.string(),
      suggestedCorrection: z.string().nullable(),
    }),
  ),
});

export type DealBuilderInput = z.infer<typeof DealBuilderSchema>;
export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;
