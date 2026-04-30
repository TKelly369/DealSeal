import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteDealerCalendarEventAction } from "./actions";
import { DealerCalendarClient, type CalendarEventRow } from "./DealerCalendarClient";

export default async function DealerCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/calendar");

  const rows = await prisma.calendarEvent.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { startsAt: "asc" },
    take: 200,
  });

  const events: CalendarEventRow[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    notes: r.notes,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt?.toISOString() ?? null,
    allDay: r.allDay,
    dealId: r.dealId,
  }));

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Calendar</h1>
        <Link className="btn btn-secondary" href="/dealer/dashboard">
          Dashboard
        </Link>
      </div>

      <DealerCalendarClient events={events} deleteAction={deleteDealerCalendarEventAction} />
    </div>
  );
}
