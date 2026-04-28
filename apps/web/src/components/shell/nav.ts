import { FileText, FolderKanban, LayoutDashboard, Settings, ShieldCheck } from "lucide-react";

export const shellNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/workspace", label: "Workflows", icon: FolderKanban, adminOnly: false },
  { href: "/documents", label: "Documents", icon: FileText, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: false },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];
