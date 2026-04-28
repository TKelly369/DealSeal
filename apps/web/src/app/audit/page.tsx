import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuditExplorer } from "./AuditExplorer";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/admin/audit");
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PLATFORM_ADMIN") {
    redirect("/dashboard");
  }
  return (
    <div>
      <h1>Audit timeline</h1>
      <AuditExplorer />
    </div>
  );
}
