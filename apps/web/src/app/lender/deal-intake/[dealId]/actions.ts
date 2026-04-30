"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";
import { prisma } from "@/lib/db";
import { AmendmentService } from "@/lib/services/amendment.service";

const intakeDealPath = (dealId: string) => `/lender/deal-intake/${dealId}`;

async function requireLenderDeal(dealId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "lender");
  if (!deal) throw new Error("Deal not found or access denied.");
  return { session, deal };
}

export async function lenderFinalRISCFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const file = formData.get("file");
  const fileName = file instanceof File && file.name ? file.name : "risc-lender-final.pdf";
  await requireLenderDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await DealWorkflowService.lenderApproveAndSendFinalRISC(dealId, { fileName }, session.user.id, session.user.role);
  revalidatePath(intakeDealPath(dealId));
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function approveAmendmentIntakeFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const amendmentId = String(formData.get("amendmentId") || "");
  const { session } = await requireLenderDeal(dealId);
  if (!amendmentId) throw new Error("Missing amendment.");
  const amendment = await prisma.amendment.findUnique({ where: { id: amendmentId } });
  if (!amendment || amendment.dealId !== dealId) throw new Error("Amendment not found.");
  await AmendmentService.approveAmendment(amendmentId, session.user.id, session.user.role);
  revalidatePath(intakeDealPath(dealId));
  revalidatePath(`/dealer/deals/${dealId}`);
  revalidatePath("/lender/assets");
}

export async function rejectAmendmentIntakeFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const amendmentId = String(formData.get("amendmentId") || "");
  const { session } = await requireLenderDeal(dealId);
  if (!amendmentId) throw new Error("Missing amendment.");
  const amendment = await prisma.amendment.findUnique({ where: { id: amendmentId } });
  if (!amendment || amendment.dealId !== dealId) throw new Error("Amendment not found.");
  await AmendmentService.rejectAmendment(amendmentId, session.user.id);
  revalidatePath(intakeDealPath(dealId));
  revalidatePath(`/dealer/deals/${dealId}`);
  revalidatePath("/lender/assets");
}
