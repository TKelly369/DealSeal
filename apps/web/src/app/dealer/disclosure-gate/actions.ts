"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDealerStaffRole } from "@/lib/role-policy";
import { hasUploadedDealerOpeningDisclosure, getWorkspaceType } from "@/lib/onboarding-status";
import { buildOpeningDisclosureObjectKey, getDealSealStorage, safeDisplayToken } from "@/lib/storage/deal-seal-storage";

const MAX_BYTES = 30 * 1024 * 1024;

export type OpeningDisclosureActionState = { error: string } | null;

export async function uploadDealerOpeningDisclosureAction(
  _prev: OpeningDisclosureActionState,
  formData: FormData,
): Promise<OpeningDisclosureActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in again to continue." };
  }
  if (!isDealerStaffRole(session.user.role)) {
    return { error: "Only dealer users can file the opening disclosure." };
  }
  const workspaceId = session.user.workspaceId;
  const wsType = await getWorkspaceType(workspaceId);
  if (wsType !== "DEALERSHIP") {
    return { error: "Opening disclosure applies to dealer workspaces only." };
  }

  const profile = await prisma.dealerProfile.findUnique({
    where: { workspaceId },
    select: { id: true },
  });
  if (!profile) {
    return { error: "Complete dealer onboarding first (dealer profile is required)." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF or other document file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "File is too large (max 30 MB)." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const token = safeDisplayToken();
  const key = buildOpeningDisclosureObjectKey({
    workspaceId,
    safeFileToken: token,
    originalFileName: file.name || "opening-disclosure.pdf",
  });

  const storage = getDealSealStorage();
  const put = await storage.putObject({
    key,
    body: buf,
    contentType: file.type || "application/pdf",
    computeSha256: true,
  });

  await prisma.dealerProfile.update({
    where: { workspaceId },
    data: {
      openingDisclosureUploadedAt: new Date(),
      openingDisclosureStorageKey: put.key,
      openingDisclosureOriginalName: file.name || "opening-disclosure.pdf",
      openingDisclosureSha256: put.sha256 ?? null,
    },
  });

  revalidatePath("/dealer", "layout");
  revalidatePath("/dealer/dashboard");
  revalidatePath("/dealer/disclosure-gate");
  redirect("/dealer/disclosure-gate");
}
