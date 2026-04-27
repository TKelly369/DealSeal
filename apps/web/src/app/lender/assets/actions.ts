"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SecondaryMarketService } from "@/lib/services/secondary-market.service";
import { AmendmentService } from "@/lib/services/amendment.service";

export async function addDealToPoolFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const poolId = String(formData.get("poolId") || "");
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!dealId || !poolId) throw new Error("Missing deal or pool.");

  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.lenderId !== session.user.workspaceId) {
    throw new Error("Deal not found or access denied.");
  }

  await SecondaryMarketService.addDealToPool(dealId, poolId);
  revalidatePath("/lender/assets");
}

export async function approveAmendmentFormAction(formData: FormData) {
  const amendmentId = String(formData.get("amendmentId") || "");
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!amendmentId) throw new Error("Missing amendment.");

  const amendment = await prisma.amendment.findUnique({
    where: { id: amendmentId },
    include: { deal: true },
  });
  if (!amendment || amendment.deal.lenderId !== session.user.workspaceId) {
    throw new Error("Amendment not found or access denied.");
  }

  await AmendmentService.approveAmendment(amendmentId, session.user.id, session.user.role);
  revalidatePath("/lender/assets");
  revalidatePath(`/dealer/deals/${amendment.dealId}`);
}

export async function rejectAmendmentFormAction(formData: FormData) {
  const amendmentId = String(formData.get("amendmentId") || "");
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!amendmentId) throw new Error("Missing amendment.");

  const amendment = await prisma.amendment.findUnique({
    where: { id: amendmentId },
    include: { deal: true },
  });
  if (!amendment || amendment.deal.lenderId !== session.user.workspaceId) {
    throw new Error("Amendment not found or access denied.");
  }

  await AmendmentService.rejectAmendment(amendmentId, session.user.id);
  revalidatePath("/lender/assets");
  revalidatePath(`/dealer/deals/${amendment.dealId}`);
}
