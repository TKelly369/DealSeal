import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { updateSystemConfig } from "@/app/admin/actions";

export default async function AdminSystemConfigPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/system-config");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>System Configuration</h2>
      <p style={{ color: "var(--muted)" }}>Runtime controls and environment-level toggles.</p>
      <form
        action={async (formData) => {
          "use server";
          const session = await auth();
          if (!session?.user) redirect("/login?next=/admin/system-config");
          if (session.user.role !== "ADMIN") redirect("/dashboard");
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
  );
}
