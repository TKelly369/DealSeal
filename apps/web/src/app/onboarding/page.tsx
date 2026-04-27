import { redirect } from "next/navigation";
import Link from "next/link";

export default async function OnboardingGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  if (role === "dealer") redirect("/dealer/onboarding");
  if (role === "lender") redirect("/lender/onboarding");

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: "2.5rem 1rem" }}>
      <main style={{ maxWidth: 520, margin: "0 auto" }} className="card">
        <h1 style={{ marginTop: 0 }}>Get started</h1>
        <p style={{ color: "var(--muted)" }}>Choose how you work with DealSeal.</p>
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.25rem" }}>
          <Link href="/onboarding?role=dealer" className="btn">
            Continue as Dealer
          </Link>
          <Link href="/onboarding?role=lender" className="btn btn-secondary">
            Continue as Lender
          </Link>
          <Link href="/login" style={{ fontSize: "0.9rem", color: "#c0c0c0", marginTop: "0.5rem" }}>
            Already have an account? Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
