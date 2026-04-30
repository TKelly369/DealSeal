"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { LoanPoolStatus, LoanPoolType, LoanPoolSaleStage } from "@/generated/prisma";
import { getWorkspaceType } from "@/lib/onboarding-status";
import { isLenderManagerRole } from "@/lib/role-policy";
import { LoanPoolService } from "@/lib/services/loan-pool.service";

async function requireLenderWorkspace() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const ws = await getWorkspaceType(session.user.workspaceId);
  if (ws !== "LENDER") {
    throw new Error("Only lender workspaces can manage loan pools.");
  }
  return session.user;
}

async function requireLenderPoolManager() {
  const user = await requireLenderWorkspace();
  if (!isLenderManagerRole(user.role)) {
    throw new Error("Loan pool changes require a lender manager role.");
  }
  return user;
}

export async function createLoanPoolAction(formData: FormData) {
  const user = await requireLenderPoolManager();
  const poolName = String(formData.get("poolName") ?? "").trim();
  const poolTypeRaw = String(formData.get("poolType") ?? "CUSTOM").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const targetSize = Number(formData.get("targetSize") ?? 100);
  if (!poolName) throw new Error("Pool name is required.");

  const poolType = (Object.values(LoanPoolType) as string[]).includes(poolTypeRaw)
    ? (poolTypeRaw as LoanPoolType)
    : LoanPoolType.CUSTOM;

  const lenderId = user.workspaceId;
  await LoanPoolService.createPool({
    lenderId,
    createdByUserId: user.id,
    poolName,
    poolType,
    description,
    targetSize: Number.isFinite(targetSize) ? targetSize : 100,
  });

  revalidatePath("/lender/pools");
}

export async function addDealToPoolAction(poolId: string, dealId: string) {
  const user = await requireLenderPoolManager();
  await LoanPoolService.addDealToPool({
    poolId,
    dealId: dealId.trim(),
    lenderId: user.workspaceId,
    actorUserId: user.id,
  });
  revalidatePath(`/lender/pools/${poolId}`);
  revalidatePath("/lender/pools");
}

export async function removeDealFromPoolAction(poolId: string, dealId: string) {
  const user = await requireLenderPoolManager();
  await LoanPoolService.removeDealFromPool({
    poolId,
    dealId: dealId.trim(),
    lenderId: user.workspaceId,
    actorUserId: user.id,
  });
  revalidatePath(`/lender/pools/${poolId}`);
}

export async function updatePoolStatusAction(
  poolId: string,
  status: LoanPoolStatus,
  saleStage?: LoanPoolSaleStage | null,
) {
  const user = await requireLenderPoolManager();
  await LoanPoolService.updatePoolStatus({
    poolId,
    lenderId: user.workspaceId,
    status,
    saleStage: saleStage ?? undefined,
    actorUserId: user.id,
  });
  revalidatePath(`/lender/pools/${poolId}`);
}

export async function generatePoolPackageAction(poolId: string) {
  const user = await requireLenderPoolManager();
  const result = await LoanPoolService.generatePoolPackagePlaceholder(poolId, user.workspaceId);
  revalidatePath(`/lender/pools/${poolId}`);
  return result;
}

export async function transitionPoolAction(formData: FormData) {
  const user = await requireLenderPoolManager();
  const poolId = String(formData.get("poolId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  if (!poolId) throw new Error("Missing pool.");

  const map: Record<string, LoanPoolStatus> = {
    active: LoanPoolStatus.ACTIVE,
    ready: LoanPoolStatus.READY_FOR_SALE,
    sold: LoanPoolStatus.SOLD,
  };
  const status = map[intent];
  if (!status) throw new Error("Invalid transition.");

  await LoanPoolService.updatePoolStatus({
    poolId,
    lenderId: user.workspaceId,
    status,
    actorUserId: user.id,
  });
  revalidatePath(`/lender/pools/${poolId}`);
}
