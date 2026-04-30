"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CalendarEventKind } from "@/generated/prisma";
import { isAdminShellRole } from "@/lib/role-policy";

const KINDS: CalendarEventKind[] = [
  "FOLLOW_UP",
  "DOCUMENT_REMINDER",
  "FUNDING_TASK",
  "CUSTOMER_SIGNING",
  "LENDER_CONDITION",
  "TITLE_REGISTRATION",
  "REPO_REPLEVIN_REVIEW",
  "INTERNAL_NOTE",
  "ALERT_REMINDER",
];

function parseKind(raw: string): CalendarEventKind {
  return (KINDS.includes(raw as CalendarEventKind) ? raw : "FOLLOW_UP") as CalendarEventKind;
}

async function requireAdminUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/calendar");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");
  return session.user;
}

export async function createAdminCalendarEventAction(formData: FormData): Promise<void> {
  await requireAdminUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required.");

  const startsAtRaw = String(formData.get("startsAt") || "");
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start date.");

  const endsRaw = String(formData.get("endsAt") || "").trim();
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Invalid end date.");

  const workspaceIdRaw = String(formData.get("workspaceId") || "").trim();
  if (!workspaceIdRaw) throw new Error("Workspace ID is required.");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceIdRaw },
    select: { id: true },
  });
  if (!workspace) throw new Error("Workspace not found.");

  const dealIdRaw = String(formData.get("dealId") || "").trim();
  const dealId = dealIdRaw || null;
  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, dealerId: true, lenderId: true },
    });
    if (!deal) throw new Error("Deal not found.");
    if (deal.dealerId !== workspaceIdRaw && deal.lenderId !== workspaceIdRaw) {
      throw new Error("Deal does not belong to the target workspace.");
    }
  }

  await prisma.calendarEvent.create({
    data: {
      workspaceId: workspaceIdRaw,
      kind: parseKind(String(formData.get("kind") || "FOLLOW_UP")),
      title,
      notes: String(formData.get("notes") || "").trim() || null,
      startsAt,
      endsAt,
      allDay: formData.get("allDay") === "on",
      dealId,
    },
  });

  revalidatePath("/admin/calendar");
}

export async function deleteAdminCalendarEventAction(eventId: string): Promise<void> {
  await requireAdminUser();
  await prisma.calendarEvent.deleteMany({ where: { id: eventId } });
  revalidatePath("/admin/calendar");
}
