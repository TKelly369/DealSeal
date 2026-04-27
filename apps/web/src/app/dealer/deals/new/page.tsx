import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealerLenderLinkService } from "@/lib/services/link.service";
import { AuthoritativeContractService } from "@/lib/services/contract.service";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { BillingGateService, BillingLimitExceeded } from "@/lib/services/billing-gate.service";
import { prisma } from "@/lib/db";
import { DealBuilderClient } from "./DealBuilderClient";

export default async function DealerDealBuilderPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dealer/deals/new");
  const dealerId = session.user.workspaceId;
  const links = await DealerLenderLinkService.getActiveLinksForDealer(dealerId);

  return (
    <DealBuilderClient
      links={links.map((l) => ({
        id: l.id,
        lenderName: l.lender.name,
        lenderId: l.lender.id,
      }))}
      createDeal={async (fd) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/login?next=/dealer/deals/new");
        const linkId = String(fd.get("dealerLenderLinkId") || "");
        const active = await DealerLenderLinkService.getActiveLinksForDealer(fresh.user.workspaceId);
        const match = active.find((l) => l.id === linkId);
        if (!match) throw new Error("No active lender link for selected lender.");
        try {
          await BillingGateService.checkDealLimit(fresh.user.workspaceId);
        } catch (e) {
          if (e instanceof BillingLimitExceeded) {
            throw new Error("Upgrade to Pro to create more deals this month.");
          }
          throw e;
        }

        const deal = await AuthoritativeContractService.generateCanonicalDeal({
          dealerId: fresh.user.workspaceId,
          lenderId: match.lender.id,
          dealerLenderLinkId: linkId,
          state: String(fd.get("state") || "TX"),
          party: {
            firstName: String(fd.get("firstName") || ""),
            lastName: String(fd.get("lastName") || ""),
            address: String(fd.get("address") || ""),
            creditTier: String(fd.get("creditTier") || ""),
          },
          vehicle: {
            year: Number(fd.get("year") || 2024),
            make: String(fd.get("make") || ""),
            model: String(fd.get("model") || ""),
            vin: String(fd.get("vin") || ""),
            mileage: Number(fd.get("mileage") || 0),
            condition: String(fd.get("condition") || "USED") as "NEW" | "USED",
          },
          financials: {
            amountFinanced: Number(fd.get("amountFinanced") || 0),
            ltv: Number(fd.get("ltv") || 0),
            maxLtv: Number(fd.get("maxLtv") || 0),
            taxes: Number(fd.get("taxes") || 0),
            fees: Number(fd.get("fees") || 0),
            gap: Number(fd.get("gap") || 0),
            warranty: Number(fd.get("warranty") || 0),
            totalSalePrice: Number(fd.get("totalSalePrice") || 0),
          },
        });
        await prisma.workspace.update({
          where: { id: fresh.user.workspaceId },
          data: { dealCountCurrentPeriod: { increment: 1 } },
        });
        return { dealId: deal.id };
      }}
      runCompliance={async (dealId) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/login?next=/dealer/deals/new");
        const state = await ComplianceEngineService.runStateCompliance(dealId);
        const lender = await ComplianceEngineService.runLenderCompliance(dealId);
        const overall =
          state.status === "BLOCKED" || lender.status === "BLOCKED"
            ? "BLOCKED"
            : state.status === "WARNING" || lender.status === "WARNING"
              ? "WARNING"
              : "COMPLIANT";
        return { status: overall, checks: [...state.checks, ...lender.checks] };
      }}
      generateDoc={async (dealId, docType) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/login?next=/dealer/deals/new");
        const doc = await AuthoritativeContractService.generateDownstreamDocument(dealId, docType);
        return { id: doc.id, type: doc.type, version: doc.version };
      }}
    />
  );
}
