import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a DealSeal organization and administrator account.",
};

export default function SignupPage() {
  return <RegisterForm loginHref="/login" />;
}
