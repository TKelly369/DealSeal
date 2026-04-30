import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminShellRole } from "@/lib/role-policy";
import { AuditExplorer } from "./AuditExplorer";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/admin/audit");
  }
  if (!isAdminShellRole(session.user.role)) {
    redirect("/dashboard");
  }
  return (
    <div>
      <h1>Audit timeline</h1>
      <AuditExplorer />
    </div>
  );
}
