"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { CalendarEventKind } from "@/generated/prisma";
import { createAdminCalendarEventAction } from "./actions";

const KIND_OPTIONS: { value: CalendarEventKind; label: string }[] = [
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "DOCUMENT_REMINDER", label: "Document reminder" },
  { value: "FUNDING_TASK", label: "Funding task" },
  { value: "CUSTOMER_SIGNING", label: "Customer signing" },
  { value: "LENDER_CONDITION", label: "Lender condition deadline" },
  { value: "TITLE_REGISTRATION", label: "Title / registration" },
  { value: "REPO_REPLEVIN_REVIEW", label: "Repo / replevin review date" },
  { value: "INTERNAL_NOTE", label: "Internal note" },
  { value: "ALERT_REMINDER", label: "Alert reminder" },
];

export type AdminCalendarEventRow = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsAt: string;
  workspaceId: string;
  dealId: string | null;
};

function SubmitCalendar() {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? "Saving..." : "Add event"}</button>;
}

export function AdminCalendarClient({
  events,
  deleteAction,
}: {
  events: AdminCalendarEventRow[];
  deleteAction: (eventId: string) => Promise<void>;
}) {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      try {
        await createAdminCalendarEventAction(formData);
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Could not save event." };
      }
    },
    null,
  );

  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)" }}>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Title</th>
              <th>Workspace</th>
              <th>Deal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.startsAt).toLocaleString()}</td>
                <td>{event.kind}</td>
                <td>{event.title}</td>
                <td>{event.workspaceId}</td>
                <td>{event.dealId ?? "-"}</td>
                <td>
                  <button type="button" className="btn btn-secondary" onClick={() => void deleteAction(event.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ alignSelf: "start" }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          New admin event
        </p>
        {state?.error ? (
          <p style={{ color: "#f87171", fontSize: "0.9rem" }} role="alert">
            {state.error}
          </p>
        ) : null}
        <form action={formAction} className="ds-form-grid">
          <label>
            Workspace ID
            <input name="workspaceId" required placeholder="workspace-main" />
          </label>
          <label>
            Type
            <select name="kind" defaultValue="INTERNAL_NOTE">
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input name="title" required placeholder="e.g. Custody review follow-up" />
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
            <input name="dealId" placeholder="Deal ID linked to this event" />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <SubmitCalendar />
        </form>
      </div>
    </div>
  );
}
