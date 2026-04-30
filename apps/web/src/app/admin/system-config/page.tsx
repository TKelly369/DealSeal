import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminManagementRole } from "@/lib/role-policy";
import {
  executeCustodialPurgeRun,
  getCustodialPerformanceReport,
  updateSystemConfig,
} from "@/app/admin/actions";

export default async function AdminSystemConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/system-config");
  if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
  const custody = await getCustodialPerformanceReport();

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
        </div>
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
      </div>
    </div>
  );
}
