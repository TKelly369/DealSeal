import { prisma } from "@/lib/db";
import type { WorkspaceType } from "@/generated/prisma";

export async function hasCompletedDealerOnboarding(dealerWorkspaceId: string): Promise<boolean> {
  const row = await prisma.dealerOnboardingAnswer.findFirst({
    where: { dealerId: dealerWorkspaceId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function hasCompletedLenderOnboarding(lenderWorkspaceId: string): Promise<boolean> {
  const row = await prisma.lenderOnboardingAnswer.findFirst({
    where: { lenderId: lenderWorkspaceId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getWorkspaceType(workspaceId: string): Promise<WorkspaceType | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { type: true },
  });
  return ws?.type ?? null;
}
