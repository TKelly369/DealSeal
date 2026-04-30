import { prisma } from "@/lib/db";
import type { WorkspaceType } from "@/generated/prisma";

function logOnboardingReadError(context: string, error: unknown): void {
  console.error(`[DealSeal] ${context} (degraded — allowing navigation)`, error);
}

export async function hasCompletedDealerOnboarding(dealerWorkspaceId: string): Promise<boolean> {
  try {
    const row = await prisma.dealerOnboardingAnswer.findFirst({
      where: { dealerId: dealerWorkspaceId },
      select: { id: true },
    });
    return Boolean(row);
  } catch (e) {
    logOnboardingReadError("hasCompletedDealerOnboarding", e);
    return true;
  }
}

export async function hasCompletedLenderOnboarding(lenderWorkspaceId: string): Promise<boolean> {
  try {
    const row = await prisma.lenderOnboardingAnswer.findFirst({
      where: { lenderId: lenderWorkspaceId },
      select: { id: true },
    });
    return Boolean(row);
  } catch (e) {
    logOnboardingReadError("hasCompletedLenderOnboarding", e);
    return true;
  }
}

export async function getWorkspaceType(workspaceId: string): Promise<WorkspaceType | null> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { type: true },
    });
    return ws?.type ?? null;
  } catch (e) {
    logOnboardingReadError("getWorkspaceType", e);
    return null;
  }
}

/** First lock: dealer org must file opening disclosure before deal work. */
export async function hasUploadedDealerOpeningDisclosure(dealerWorkspaceId: string): Promise<boolean> {
  try {
    const row = await prisma.dealerProfile.findUnique({
      where: { workspaceId: dealerWorkspaceId },
      select: { openingDisclosureUploadedAt: true },
    });
    return row?.openingDisclosureUploadedAt != null;
  } catch (e) {
    logOnboardingReadError("hasUploadedDealerOpeningDisclosure", e);
    return true;
  }
}
