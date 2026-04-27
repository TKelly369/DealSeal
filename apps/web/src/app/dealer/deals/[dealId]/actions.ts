"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";
import { AutopublishService } from "@/lib/services/autopublish.service";
import { AmendmentReason } from "@/generated/prisma";
import { AmendmentService } from "@/lib/services/amendment.service";
import { DealAlertService } from "@/lib/services/deal-alert.service";

async function requireDealerDeal(dealId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "dealer");
  if (!deal) throw new Error("Deal not found or access denied.");
  return { session, deal };
}

export async function acknowledgeDisclosureFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const { session } = await requireDealerDeal(dealId);
  await DealWorkflowService.acknowledgeDisclosure(dealId, session.user.id, session.user.role);
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function uploadGreenStageDocAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const docType = String(formData.get("docType") || "");
  const file = formData.get("file");
  const fileName = file instanceof File && file.name ? file.name : "upload.pdf";
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await DealWorkflowService.uploadGreenStageDoc(
    dealId,
    { fileName, docType },
    session.user.id,
    session.user.role,
  );
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function submitUnsignedRISCAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const file = formData.get("file");
  const fileName = file instanceof File && file.name ? file.name : "risc-unsigned.pdf";
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await DealWorkflowService.submitUnsignedRISC(dealId, { fileName }, session.user.id, session.user.role);
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function uploadSignedRISCAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const file = formData.get("file");
  const fileName = file instanceof File && file.name ? file.name : "risc-signed.pdf";
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  try {
    await DealWorkflowService.uploadSignedRISCAndLock(dealId, { fileName }, session.user.id, session.user.role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("UCC validation")) {
      throw new Error(
        "We couldn't finalize this deal yet. Confirm the buyer and vehicle on the deal match your signed contract, then try again—or ask your lender to re-post the final contract if something changed.",
      );
    }
    throw e;
  }
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function retryAutopublishFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await AutopublishService.generateUniformClosingPackage(dealId, session.user.id, session.user.role);
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function requestAmendmentFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const reason = String(formData.get("reason") || "") as AmendmentReason;
  const vin = String(formData.get("vin") || "").trim().toUpperCase();
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!Object.values(AmendmentReason).includes(reason)) throw new Error("Invalid amendment reason.");

  const amendedFields: Record<string, unknown> = {};
  if (vin) {
    amendedFields.vehicle = { vin };
  }
  await AmendmentService.requestAmendment(
    dealId,
    {
      reason,
      amendedFields,
    },
    session.user.id,
  );
  revalidatePath(`/dealer/deals/${dealId}`);
  revalidatePath("/lender/assets");
  revalidatePath("/lender/intake");
}

export async function clearDealAlertFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const alertId = String(formData.get("alertId") || "");
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await DealAlertService.clearAlert(alertId, session.user.id, session.user.role);
  revalidatePath(`/dealer/deals/${dealId}`);
}

export async function overrideDealAlertFormAction(formData: FormData) {
  const dealId = String(formData.get("dealId") || "");
  const alertId = String(formData.get("alertId") || "");
  const note = String(formData.get("note") || "");
  await requireDealerDeal(dealId);
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await DealAlertService.overrideAlert(alertId, note, session.user.id, session.user.role);
  revalidatePath(`/dealer/deals/${dealId}`);
}
