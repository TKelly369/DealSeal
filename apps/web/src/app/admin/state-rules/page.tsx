import { auth } from "@/lib/auth";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminStateRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/state-rules");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>State rules</h1>
      <div className="card">
        <p style={{ margin: 0 }}>
          State-level disclosure, fee, and compliance rule management is reserved for this module.
        </p>
      </div>
    </div>
  );
}
