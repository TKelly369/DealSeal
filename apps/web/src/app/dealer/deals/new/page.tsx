import { auth } from "@/lib/auth";
import { Prisma } from "@/generated/prisma";
import { redirect } from "next/navigation";
import { DealerLenderLinkService } from "@/lib/services/link.service";
import { AuthoritativeContractService } from "@/lib/services/contract.service";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { BillingGateService, BillingLimitExceeded } from "@/lib/services/billing-gate.service";
import { prisma } from "@/lib/db";
import { DealBuilderClient } from "./DealBuilderClient";

export default async function DealerDealBuilderPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/deals/new");
  const dealerId = session.user.workspaceId;
  let links: Awaited<ReturnType<typeof DealerLenderLinkService.getActiveLinksForDealer>> = [];
  try {
    links = await DealerLenderLinkService.getActiveLinksForDealer(dealerId);
  } catch (e) {
    // Keep page render resilient when Prisma/database is temporarily unavailable.
    console.error("[DealSeal] DealerDealBuilderPage: failed to load lender links", e);
  }

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
        if (!fresh?.user) redirect("/dealer/login?next=/dealer/deals/new");
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

        const coFirst = String(fd.get("coBuyerFirstName") || "").trim();
        const coLast = String(fd.get("coBuyerLastName") || "").trim();
        const coBuyerName =
          [coFirst, coLast].filter(Boolean).join(" ").trim() || String(fd.get("coBuyerName") || "").trim();

        const deal = await AuthoritativeContractService.generateCanonicalDeal({
          dealerId: fresh.user.workspaceId,
          lenderId: match.lender.id,
          dealerLenderLinkId: linkId,
          state: String(fd.get("state") || "TX"),
          party: {
            firstName: String(fd.get("firstName") || ""),
            lastName: String(fd.get("lastName") || ""),
            address: String(fd.get("address") || ""),
            coBuyerName: coBuyerName || undefined,
            contactInfo: String(fd.get("contactInfo") || ""),
            creditTier: String(fd.get("creditTier") || ""),
          },
          vehicle: {
            year: fd.get("year") ? Number(fd.get("year")) : undefined,
            make: String(fd.get("make") || ""),
            model: String(fd.get("model") || ""),
            vin: String(fd.get("vin") || ""),
            stockNumber: String(fd.get("stockNumber") || ""),
            mileage: fd.get("mileage") ? Number(fd.get("mileage")) : undefined,
            condition: (String(fd.get("condition") || "USED") as "NEW" | "USED") ?? undefined,
          },
          assignedDealerUserId: String(fd.get("assignedDealerUserId") || fresh.user.id),
          dealerRepresentative: String(fd.get("dealerRepresentative") || ""),
          dealershipLocation: String(fd.get("dealershipLocation") || ""),
        });

        const preliminarySubmittedTerms = {
          builderVersion: 2,
          coBuyer: {
            firstName: coFirst,
            lastName: coLast,
            address: String(fd.get("coBuyerAddress") || "").trim(),
          },
          pricing: {
            notes: String(fd.get("pricingNotes") || ""),
            amountFinanced: fd.get("amountFinanced") ? String(fd.get("amountFinanced")) : null,
          },
          taxes: {
            notes: String(fd.get("taxesNotes") || ""),
            amount: fd.get("taxesAmount") ? String(fd.get("taxesAmount")) : null,
          },
          fees: {
            notes: String(fd.get("feesNotes") || ""),
            amount: fd.get("feesAmount") ? String(fd.get("feesAmount")) : null,
          },
          addOns: String(fd.get("addOnsNotes") || ""),
          tradeIn: String(fd.get("tradeInNotes") || ""),
          downPayment: {
            amount: fd.get("downPaymentAmount") ? String(fd.get("downPaymentAmount")) : null,
            notes: String(fd.get("downPaymentNotes") || ""),
          },
        };

        await prisma.deal.update({
          where: { id: deal.id },
          data: { preliminarySubmittedTerms: preliminarySubmittedTerms as Prisma.InputJsonValue },
        });

        const af = String(fd.get("amountFinanced") || "").trim();
        if (af) {
          try {
            const amt = new Prisma.Decimal(af);
            const taxes = new Prisma.Decimal(String(fd.get("taxesAmount") || "0"));
            const fees = new Prisma.Decimal(String(fd.get("feesAmount") || "0"));
            const totalRaw = String(fd.get("totalSalePrice") || "").trim();
            const totalDec = totalRaw ? new Prisma.Decimal(totalRaw) : amt.plus(taxes).plus(fees);
            await prisma.dealFinancials.create({
              data: {
                dealId: deal.id,
                amountFinanced: amt,
                ltv: new Prisma.Decimal(0.85),
                maxLtv: new Prisma.Decimal(0.9),
                taxes,
                fees,
                gap: new Prisma.Decimal(0),
                warranty: new Prisma.Decimal(0),
                totalSalePrice: totalDec,
              },
            });
          } catch (err) {
            console.warn("[DealSeal] deal financials not created from builder", err);
          }
        }

        await prisma.workspace.update({
          where: { id: fresh.user.workspaceId },
          data: { dealCountCurrentPeriod: { increment: 1 } },
        });
        return { dealId: deal.id };
      }}
      runCompliance={async (dealId) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/dealer/login?next=/dealer/deals/new");
        const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { status: true } });
        if (!deal || deal.status === "DISCLOSURE_REQUIRED") {
          throw new Error("Upload and accept the signed Initial Disclosure before running compliance.");
        }
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
        if (!fresh?.user) redirect("/dealer/login?next=/dealer/deals/new");
        const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { status: true } });
        if (!deal || deal.status === "DISCLOSURE_REQUIRED") {
          throw new Error("Upload and accept the signed Initial Disclosure before generating documents.");
        }
        const doc = await AuthoritativeContractService.generateDownstreamDocument(dealId, docType);
        return { id: doc.id, type: doc.type, version: doc.version };
      }}
    />
  );
}
