import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LenderOpsService } from "@/lib/services/lender-ops.service";
import {
  createLenderTaskAction,
  updateLenderTaskStatusAction,
  updateMissingItemRequestStatusAction,
} from "./actions";

export default async function LenderTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/tasks");
  const lenderId = session.user.workspaceId;
  const [tasks, missingItems] = await Promise.all([
    LenderOpsService.listTasks(lenderId),
    LenderOpsService.listMissingItemRequests(lenderId),
  ]);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Tasks</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Lifecycle inbox across intake, funding, post-funding, enforcement readiness, pooling, and secondary market work.
      </p>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          New task
        </h2>
        <form action={createLenderTaskAction} style={{ display: "grid", gap: "0.5rem" }}>
          <input className="ds-input" name="title" required placeholder="Task title" />
          <textarea className="ds-input" name="description" rows={2} placeholder="Description (optional)" />
          <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <select className="ds-input" name="category" defaultValue="deal_intake">
              <option value="dealer_relationship">Dealer relationship</option>
              <option value="deal_intake">Deal intake</option>
              <option value="contract_integrity">Contract integrity</option>
              <option value="funding">Funding</option>
              <option value="post_funding">Post-funding</option>
              <option value="enforcement_readiness">Enforcement readiness</option>
              <option value="pooling">Pooling</option>
              <option value="secondary_market">Secondary market</option>
              <option value="document_custody">Document custody</option>
            </select>
            <select className="ds-input" name="priority" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input className="ds-input" type="date" name="dueDate" />
          </div>
          <button className="btn" type="submit">
            Create lender task
          </button>
        </form>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Open task queue
        </h2>
        {tasks.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No lender tasks yet.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.category}</td>
                  <td>{task.priority}</td>
                  <td>{task.status}</td>
                  <td>{task.dueDate ? task.dueDate.toLocaleDateString() : "—"}</td>
                  <td>
                    <form action={updateLenderTaskStatusAction} style={{ display: "flex", gap: "0.35rem" }}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <select name="status" className="btn btn-secondary" defaultValue={task.status}>
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button type="submit" className="btn btn-secondary">
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Missing dealer item requests
        </h2>
        {missingItems.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No outstanding missing-item requests.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {missingItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.requestedItemType}</td>
                  <td>{item.status}</td>
                  <td>{item.priority}</td>
                  <td>{item.dueDate ? item.dueDate.toLocaleDateString() : "—"}</td>
                  <td>
                    <form action={updateMissingItemRequestStatusAction} style={{ display: "flex", gap: "0.35rem" }}>
                      <input type="hidden" name="requestId" value={item.id} />
                      <select name="status" className="btn btn-secondary" defaultValue={item.status}>
                        <option value="requested">Requested</option>
                        <option value="uploaded">Uploaded</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="overdue">Overdue</option>
                      </select>
                      <button type="submit" className="btn btn-secondary">
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn btn-secondary" href="/lender/calendar">
          Calendar
        </Link>
      </div>
    </div>
  );
}
