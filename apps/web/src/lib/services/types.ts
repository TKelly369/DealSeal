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
    coBuyerName: z.string().optional(),
    contactInfo: z.string().optional(),
    creditTier: z.string().optional(),
  }),
  vehicle: z.object({
    year: z.coerce.number().int().min(1980).optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    vin: z.string().min(5).optional(),
    stockNumber: z.string().optional(),
    mileage: z.coerce.number().int().min(0).optional(),
    condition: z.enum(["NEW", "USED"]).optional(),
  }),
  assignedDealerUserId: z.string().optional(),
  dealerRepresentative: z.string().optional(),
  dealershipLocation: z.string().optional(),
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
