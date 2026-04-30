import type { Metadata } from "next";
import LoginContent from "@/app/login/logincontent";

export const metadata: Metadata = {
  title: "Lender sign in",
  description: "Sign in to the DealSeal lender workspace.",
};

export default function LenderLoginPage() {
  return <LoginContent variant="lender" />;
}
