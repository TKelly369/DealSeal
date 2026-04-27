import { z } from "zod";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { BillingGateService, BillingLimitExceeded } from "@/lib/services/billing-gate.service";
import { AuthoritativeContractService } from "@/lib/services/contract.service";
import { prisma } from "@/lib/db";

const InboundDealSchema = z.object({
  lenderId: z.string().min(1),
  state: z.string().default("TX"),
  buyer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address: z.string().min(1),
    creditTier: z.string().optional(),
  }),
  vehicle: z.object({
    year: z.number().int(),
    make: z.string().min(1),
    model: z.string().min(1),
    vin: z.string().min(5),
    mileage: z.number().int().nonnegative(),
    condition: z.enum(["NEW", "USED"]).default("USED"),
  }),
  financials: z.object({
    amountFinanced: z.number(),
    ltv: z.number(),
    maxLtv: z.number(),
    taxes: z.number(),
    fees: z.number(),
    gap: z.number(),
    warranty: z.number(),
    totalSalePrice: z.number(),
  }),
});

function unauthorized() {
  return Response.json({ error: "Invalid API key." }, { status: 401 });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return unauthorized();

  const apiContext = await ApiKeyService.validateApiKey(token);
  if (!apiContext) return unauthorized();
  if (!apiContext.scopes.includes("deals:write")) {
    return Response.json({ error: "Insufficient API scope. Required: deals:write" }, { status: 403 });
  }

  const parsed = InboundDealSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  try {
    await BillingGateService.checkDealLimit(apiContext.workspaceId);
  } catch (e) {
    if (e instanceof BillingLimitExceeded) {
      return Response.json({ error: e.message }, { status: 402 });
    }
    throw e;
  }

  const link = await prisma.dealerLenderLink.findFirst({
    where: {
      dealerId: apiContext.workspaceId,
      lenderId: parsed.data.lenderId,
      status: "APPROVED",
    },
  });
  if (!link) {
    return Response.json({ error: "No approved lender link found for this workspace and lender." }, { status: 400 });
  }

  const deal = await AuthoritativeContractService.generateCanonicalDeal({
    dealerId: apiContext.workspaceId,
    lenderId: parsed.data.lenderId,
    dealerLenderLinkId: link.id,
    state: parsed.data.state,
    party: {
      firstName: parsed.data.buyer.firstName,
      lastName: parsed.data.buyer.lastName,
      address: parsed.data.buyer.address,
      creditTier: parsed.data.buyer.creditTier ?? "",
    },
    vehicle: parsed.data.vehicle,
    financials: parsed.data.financials,
  });

  await prisma.workspace.update({
    where: { id: apiContext.workspaceId },
    data: { dealCountCurrentPeriod: { increment: 1 } },
  });

  return Response.json({ dealId: deal.id }, { status: 201 });
}

