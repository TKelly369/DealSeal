import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Public verification: branded chrome (logo in header + footer) without app sidebar.
 */
export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
