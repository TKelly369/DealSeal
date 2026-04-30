import {
  Bell,
  Calendar,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Handshake,
  Home,
  Inbox,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Settings,
  Shield,
} from "lucide-react";

/** Lender platform shell — aligns with `/lender/*` route structure. */
export const lenderShellNavItems = [
  { href: "/lender", label: "Home", icon: Home },
  { href: "/lender/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/lender/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lender/deal-intake", label: "Deal intake", icon: Inbox },
  { href: "/lender/dealers", label: "Dealers", icon: Handshake },
  { href: "/lender/dealers/approval-queue", label: "Approval queue", icon: Shield },
  { href: "/lender/forms", label: "Forms", icon: FileText },
  { href: "/lender/rules", label: "Rules", icon: ScrollText },
  { href: "/lender/files", label: "Files", icon: FolderOpen },
  { href: "/lender/tasks", label: "Tasks", icon: ListTodo },
  { href: "/lender/calendar", label: "Calendar", icon: Calendar },
  { href: "/lender/alerts", label: "Alerts", icon: Bell },
  { href: "/lender/settings", label: "Settings", icon: Settings },
] as const;
