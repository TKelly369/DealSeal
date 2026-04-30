import { z } from "zod";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { BillingGateService, BillingLimitExceeded } from "@/lib/services/billing-gate.service";
import { AuthoritativeContractService } from "@/lib/services/contract.service";
import { prisma } from "@/lib/db";
import { hasUploadedDealerOpeningDisclosure } from "@/lib/onboarding-status";

const InboundDealSchema = z.object({
  lenderId: z.string().min(1),
  state: z.string().default("TX"),
  buyer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address: z.string().min(1),
    coBuyerName: z.string().optional(),
    contactInfo: z.string().optional(),
    creditTier: z.string().optional(),
  }),
  vehicle: z.object({
    year: z.number().int().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    vin: z.string().min(5).optional(),
    stockNumber: z.string().optional(),
    mileage: z.number().int().nonnegative().optional(),
    condition: z.enum(["NEW", "USED"]).optional(),
  }),
  assignedDealerUserId: z.string().optional(),
  dealerRepresentative: z.string().optional(),
  dealershipLocation: z.string().optional(),
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

  const ws = await prisma.workspace.findUnique({
    where: { id: apiContext.workspaceId },
    select: { type: true },
  });
  if (ws?.type === "DEALERSHIP" && !(await hasUploadedDealerOpeningDisclosure(apiContext.workspaceId))) {
    return Response.json(
      {
        error:
          "Opening disclosure must be uploaded before deal work (buyer/vehicle/numbers, contracts, documents, lender submit) for this dealer workspace.",
      },
      { status: 403 },
    );
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

  const deal = await AuthoritativeContractService.generateCanonicalDeal(
    {
      dealerId: apiContext.workspaceId,
      lenderId: parsed.data.lenderId,
      dealerLenderLinkId: link.id,
      state: parsed.data.state,
      party: {
        firstName: parsed.data.buyer.firstName,
        lastName: parsed.data.buyer.lastName,
        address: parsed.data.buyer.address,
        coBuyerName: parsed.data.buyer.coBuyerName ?? "",
        contactInfo: parsed.data.buyer.contactInfo ?? "",
        creditTier: parsed.data.buyer.creditTier ?? "",
      },
      vehicle: parsed.data.vehicle,
      assignedDealerUserId: parsed.data.assignedDealerUserId,
      dealerRepresentative: parsed.data.dealerRepresentative,
      dealershipLocation: parsed.data.dealershipLocation,
    },
    {
      authMethod: "API_KEY",
      actorRole: "DEALER_MANAGER",
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    },
  );

  await prisma.workspace.update({
    where: { id: apiContext.workspaceId },
    data: { dealCountCurrentPeriod: { increment: 1 } },
  });

  return Response.json({ dealId: deal.id }, { status: 201 });
}

