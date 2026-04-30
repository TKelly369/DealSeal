"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CalendarEventKind } from "@/generated/prisma";
import { redirect } from "next/navigation";

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

export async function createLenderCalendarEventAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/calendar");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required.");

  const startsAtRaw = String(formData.get("startsAt") || "");
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start date.");

  const endsRaw = String(formData.get("endsAt") || "").trim();
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("Invalid end date.");

  const kind = parseKind(String(formData.get("kind") || "FOLLOW_UP"));
  const notes = String(formData.get("notes") || "").trim() || null;
  const dealIdRaw = String(formData.get("dealId") || "").trim();
  const dealId = dealIdRaw || null;

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, lenderId: session.user.workspaceId },
      select: { id: true },
    });
    if (!deal) throw new Error("Deal not found for this lender.");
  }

  await prisma.calendarEvent.create({
    data: {
      workspaceId: session.user.workspaceId,
      kind,
      title,
      notes,
      startsAt,
      endsAt,
      allDay: formData.get("allDay") === "on",
      dealId,
    },
  });

  revalidatePath("/lender/calendar");
}

export async function deleteLenderCalendarEventAction(eventId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/calendar");

  await prisma.calendarEvent.deleteMany({
    where: { id: eventId, workspaceId: session.user.workspaceId },
  });

  revalidatePath("/lender/calendar");
}
