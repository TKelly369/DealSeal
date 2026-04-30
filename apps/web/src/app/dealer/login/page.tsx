import type { Metadata } from "next";
import LoginContent from "@/app/login/logincontent";

export const metadata: Metadata = {
  title: "Dealer sign in",
  description: "Sign in to the DealSeal dealer workspace.",
};

export default function DealerLoginPage() {
  return <LoginContent variant="dealer" />;
}
