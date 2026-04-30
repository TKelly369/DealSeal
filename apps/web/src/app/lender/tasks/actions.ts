"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

async function requireLenderUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createLenderTaskAction(formData: FormData) {
  const user = await requireLenderUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const category = String(formData.get("category") ?? "deal_intake").trim() as
    | "dealer_relationship"
    | "deal_intake"
    | "contract_integrity"
    | "funding"
    | "post_funding"
    | "enforcement_readiness"
    | "pooling"
    | "secondary_market"
    | "document_custody";
  const priority = String(formData.get("priority") ?? "medium").trim() as "low" | "medium" | "high" | "critical";
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  if (!title) throw new Error("Task title is required.");
  await LenderOpsService.createTask({
    lenderId: user.workspaceId,
    title,
    description,
    category,
    priority,
    dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    source: "manual",
  });
  revalidatePath("/lender/tasks");
  revalidatePath("/lender/dashboard");
}

export async function updateLenderTaskStatusAction(formData: FormData) {
  const user = await requireLenderUser();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as
    | "open"
    | "in_progress"
    | "blocked"
    | "completed"
    | "cancelled"
    | "overdue";
  if (!taskId) throw new Error("Task is required.");
  await LenderOpsService.updateTaskStatus({ taskId, lenderId: user.workspaceId, status });
  revalidatePath("/lender/tasks");
  revalidatePath("/lender/dashboard");
}

export async function updateMissingItemRequestStatusAction(formData: FormData) {
  const user = await requireLenderUser();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as
    | "requested"
    | "uploaded"
    | "accepted"
    | "rejected"
    | "overdue";
  if (!requestId) throw new Error("Request is required.");
  await LenderOpsService.updateMissingItemStatus({
    requestId,
    lenderId: user.workspaceId,
    status,
  });
  revalidatePath("/lender/tasks");
  revalidatePath("/lender/alerts");
  revalidatePath("/lender/dashboard");
}
