import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminManagementRole, isAdminShellRole } from "@/lib/role-policy";

const managementTabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/links", label: "Links" },
  { href: "/admin/rules", label: "Rules" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/system-config", label: "System Config" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

const opsTabs = [
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

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
  const tabs = isAdminManagementRole(session.user.role) ? managementTabs : opsTabs;

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin Console</h1>
      <p style={{ color: "var(--muted)" }}>Global controls for users, runtime, and governance.</p>
      <div className="ds-tab-row">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="btn btn-secondary">
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
