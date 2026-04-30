import {
  Award,
  Calendar,
  ClipboardCheck,
  FileStack,
  FolderOpen,
  Handshake,
  Home,
  Kanban,
  LayoutDashboard,
  ListTodo,
} from "lucide-react";

/** Dealer platform shell — aligns with `/dealer/*` route structure. */
export const dealerShellNavItems = [
  { href: "/dealer", label: "Home", icon: Home },
  { href: "/dealer/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/dealer/disclosure-gate", label: "Disclosure gate", icon: FileStack },
  { href: "/dealer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dealer/files", label: "Files", icon: FolderOpen },
  { href: "/dealer/deals", label: "Deals", icon: Kanban },
  { href: "/dealer/lenders", label: "Lenders", icon: Handshake },
  { href: "/dealer/lenders/performance", label: "Lender grades", icon: Award },
  { href: "/dealer/calendar", label: "Calendar", icon: Calendar },
  { href: "/dealer/tasks", label: "Tasks", icon: ListTodo },
] as const;
