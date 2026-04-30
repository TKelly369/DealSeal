import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminShellRole } from "@/lib/role-policy";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-dealseal-pathname") ?? "";

  /** Sign-in page must not require a session or show console chrome. */
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const session = await auth();
  if (!session?.user) {
    redirect(`/admin/login?next=${encodeURIComponent(pathname || "/admin")}`);
  }
  if (!isAdminShellRole(session.user.role)) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
