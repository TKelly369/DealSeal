import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const tabs = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/links", label: "Links" },
  { href: "/admin/rules", label: "Rules" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/system-config", label: "System Config" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/admin");
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PLATFORM_ADMIN") {
    redirect("/dashboard");
  }
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
