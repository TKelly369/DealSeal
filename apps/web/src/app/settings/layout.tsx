import Link from "next/link";

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/api-keys", label: "API Keys" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <p style={{ color: "var(--muted)" }}>Manage account, workspace, billing, and integration credentials.</p>
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
