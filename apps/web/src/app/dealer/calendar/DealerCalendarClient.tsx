"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createDealerCalendarEventAction } from "./actions";
import type { CalendarEventKind } from "@/generated/prisma";

const KIND_OPTIONS: { value: CalendarEventKind; label: string }[] = [
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "DOCUMENT_REMINDER", label: "Document reminder" },
  { value: "FUNDING_TASK", label: "Funding task" },
  { value: "CUSTOMER_SIGNING", label: "Customer signing" },
  { value: "LENDER_CONDITION", label: "Lender condition deadline" },
  { value: "TITLE_REGISTRATION", label: "Title / registration" },
];

export type CalendarEventRow = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  dealId: string | null;
};

function SubmitCalendar() {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? "Saving…" : "Add to calendar"}</button>;
}

export function DealerCalendarClient({
  events,
  deleteAction,
}: {
  events: CalendarEventRow[];
  deleteAction: (eventId: string) => Promise<void>;
}) {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      try {
        await createDealerCalendarEventAction(formData);
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Could not save event." };
      }
    },
    null,
  );

  const byDay = [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)" }}>
      <div className="card">
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Schedule
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 0 }}>
          Google Calendar–style tracking: follow-ups, document and funding dates, signings, lender conditions, and title
          deadlines. Events are listed chronologically.
        </p>
        {byDay.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No events yet. Add one with the form →</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
            {byDay.map((ev) => (
              <li
                key={ev.id}
                style={{
                  borderLeft: "3px solid var(--accent, #38bdf8)",
                  padding: "0.65rem 0.75rem",
                  marginBottom: "0.5rem",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>{ev.title}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: "0.35rem" }}>
                      {KIND_OPTIONS.find((k) => k.value === ev.kind)?.label ?? ev.kind}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                    onClick={() => void deleteAction(ev.id)}
                  >
                    Remove
                  </button>
                </div>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(ev.startsAt).toLocaleString()}
                  {ev.endsAt ? ` — ${new Date(ev.endsAt).toLocaleString()}` : null}
                  {ev.allDay ? " · All day" : null}
                </p>
                {ev.notes ? <p style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>{ev.notes}</p> : null}
                {ev.dealId ? (
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                    Deal:{" "}
                    <Link href={`/dealer/deals/${ev.dealId}`} className="btn btn-secondary" style={{ fontSize: "0.75rem" }}>
                      Open deal
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ alignSelf: "start" }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          New event
        </p>
        {state?.error ? (
          <p style={{ color: "#f87171", fontSize: "0.9rem" }} role="alert">
            {state.error}
          </p>
        ) : null}
        <form action={formAction} className="ds-form-grid">
          <label>
            Type
            <select name="kind" defaultValue="FOLLOW_UP">
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input name="title" type="text" required placeholder="e.g. Send stips to ABC Bank" />
          </label>
          <label>
            Starts
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            Ends (optional)
            <input name="endsAt" type="datetime-local" />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input name="allDay" type="checkbox" />
            All day
          </label>
          <label>
            Deal ID (optional)
            <input name="dealId" type="text" placeholder="Link to a deal" />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} placeholder="Lender condition, title clerk, etc." />
          </label>
          <SubmitCalendar />
        </form>
      </div>
    </div>
  );
}
