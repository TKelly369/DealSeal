import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminManagementRole } from "@/lib/role-policy";
import {
  executeCustodialPurgeRun,
  getCustodialPerformanceReport,
  scheduleCustodialPurgeRun,
  updateRetentionPolicy,
  updateSystemConfig,
} from "@/app/admin/actions";
import { EVaultRetentionService } from "@/lib/services/evault-retention.service";

export default async function AdminSystemConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/system-config");
  if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
  const custody = await getCustodialPerformanceReport();
  const [policies, purgeJobs] = await Promise.all([
    EVaultRetentionService.listPolicies(session.user.workspaceId),
    EVaultRetentionService.listPurgeJobs(session.user.workspaceId),
  ]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>System Configuration</h2>
        <p style={{ color: "var(--muted)" }}>Runtime controls and environment-level toggles.</p>
        <form
          action={async (formData) => {
            "use server";
            const session = await auth();
            if (!session?.user) redirect("/login?next=/admin/system-config");
            if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
            await updateSystemConfig({
              maxDocumentsPerMonth: Number(formData.get("maxDocumentsPerMonth") || 5000),
              platformFeePercent: Number(formData.get("platformFeePercent") || 2.5),
              maintenanceMode: formData.get("maintenanceMode") === "on",
            });
          }}
          className="ds-form-grid"
        >
          <label>
            Max Documents per Month
            <input name="maxDocumentsPerMonth" defaultValue="5000" />
          </label>
          <label>
            Platform Fee %
            <input name="platformFeePercent" defaultValue="2.5" />
          </label>
          <label>
            Maintenance Mode Toggle
            <input name="maintenanceMode" type="checkbox" />
          </label>
          <button type="submit" style={{ width: "fit-content", alignSelf: "end" }}>
            Save Configuration
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Custodial Performance</h2>
        <p style={{ color: "var(--muted)" }}>
          Dealseal-admin custodial controls for legal retention and purge lifecycle management.
        </p>
        <div className="ds-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: "0.8rem" }}>
          <div>
            <strong>Retention policy</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Governing contracts: {custody.policy.governingContractYears} years
              <br />
              Deal jackets: {custody.policy.dealJacketYears} years
            </p>
          </div>
          <div>
            <strong>Protected inventory</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Governing contracts: {custody.inventory.signedLockedGoverningContracts}
              <br />
              Completed deal jackets: {custody.inventory.completedDealJackets}
            </p>
          </div>
          <div>
            <strong>Purge eligible now</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Governing contracts: {custody.eligible.governingContracts}
              <br />
              Deal jackets: {custody.eligible.dealJackets}
            </p>
          </div>
          <div>
            <strong>Auto purge queue</strong>
            <p style={{ margin: "0.3rem 0 0", color: "var(--muted)" }}>
              Scheduled: {custody.purgeJobs.scheduled}
              <br />
              Running: {custody.purgeJobs.running} · Failed: {custody.purgeJobs.failed}
            </p>
          </div>
        </div>
        <h3 style={{ marginBottom: "0.45rem" }}>Retention policy controls</h3>
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.9rem" }}>
          {policies
            .filter((p) => p.recordClass === "GOVERNING_CONTRACT" || p.recordClass === "DEAL_JACKET")
            .map((policy) => (
              <form
                key={policy.recordClass}
                action={async (formData) => {
                  "use server";
                  const session = await auth();
                  if (!session?.user) redirect("/login?next=/admin/system-config");
                  if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
                  await updateRetentionPolicy({
                    recordClass: policy.recordClass,
                    retentionYears: Number(formData.get("retentionYears") || policy.retentionYears),
                    purgeMode: String(formData.get("purgeMode") || "HASH_ONLY"),
                    enabled: formData.get("enabled") === "on",
                  });
                  redirect("/admin/system-config");
                }}
                style={{ display: "grid", gap: "0.45rem", gridTemplateColumns: "1.2fr 0.8fr 1fr auto auto", alignItems: "end" }}
              >
                <label>
                  Record class
                  <input value={policy.recordClass} readOnly />
                </label>
                <label>
                  Retention years
                  <input name="retentionYears" type="number" min={1} defaultValue={policy.retentionYears} />
                </label>
                <label>
                  Purge mode
                  <select name="purgeMode" defaultValue={policy.purgeMode}>
                    <option value="HASH_ONLY">HASH_ONLY</option>
                    <option value="SOFT_PURGE">SOFT_PURGE</option>
                    <option value="DELETE_BINARY_KEEP_METADATA">DELETE_BINARY_KEEP_METADATA</option>
                  </select>
                </label>
                <label>
                  Enabled
                  <input name="enabled" type="checkbox" defaultChecked={policy.enabled} />
                </label>
                <button type="submit">Update policy</button>
              </form>
            ))}
        </div>
        <h3 style={{ marginBottom: "0.45rem" }}>Schedule auto purge run</h3>
        <form
          action={async (formData) => {
            "use server";
            const session = await auth();
            if (!session?.user) redirect("/login?next=/admin/system-config");
            if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
            const when = String(formData.get("scheduledAt") || "").trim();
            await scheduleCustodialPurgeRun({
              scheduledAt: when,
              dryRun: formData.get("dryRun") === "on",
            });
            redirect("/admin/system-config");
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "end", marginBottom: "0.9rem" }}
        >
          <label>
            Scheduled time
            <input name="scheduledAt" type="datetime-local" required />
          </label>
          <label>
            Dry run
            <input name="dryRun" type="checkbox" />
          </label>
          <button type="submit">Queue purge job</button>
        </form>
        <form
          action={async () => {
            "use server";
            const session = await auth();
            if (!session?.user) redirect("/login?next=/admin/system-config");
            if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
            await executeCustodialPurgeRun();
            redirect("/admin/system-config");
          }}
        >
          <button type="submit">Execute Custodial Purge Run</button>
        </form>
        {purgeJobs.length > 0 ? (
          <div style={{ marginTop: "0.9rem" }}>
            <strong>Recent purge jobs</strong>
            <table className="ds-table" style={{ marginTop: "0.5rem" }}>
              <thead>
                <tr>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Dry run</th>
                  <th>Finished</th>
                </tr>
              </thead>
              <tbody>
                {purgeJobs.slice(0, 10).map((job) => (
                  <tr key={job.id}>
                    <td>{job.scheduledAt.toLocaleString()}</td>
                    <td>{job.status}</td>
                    <td>{job.dryRun ? "Yes" : "No"}</td>
                    <td>{job.finishedAt ? job.finishedAt.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
