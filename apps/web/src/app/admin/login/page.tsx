import type { Metadata } from "next";
import LoginContent from "@/app/login/logincontent";

export const metadata: Metadata = {
  title: "Admin sign in",
  description: "Sign in to the DealSeal admin console.",
};

export default function AdminLoginPage() {
  return <LoginContent variant="admin" />;
}
