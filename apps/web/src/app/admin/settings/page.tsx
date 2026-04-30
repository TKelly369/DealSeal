import { auth } from "@/lib/auth";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/settings");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin settings</h1>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          Platform-level settings are centralized here. Next steps include retention windows, alert thresholds, and
          custody access policy presets.
        </p>
      </div>
    </div>
  );
}
