import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminManagementRole } from "@/lib/role-policy";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login?next=/admin");
  }
  if (isAdminManagementRole(session.user.role)) {
    redirect("/admin/users");
  }
  redirect("/admin/audit");
}
