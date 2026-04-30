import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LenderFormsPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/forms");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Forms</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Program-specific PDFs, e-contract templates, and lender intake forms will be managed here. Use{" "}
        <strong>Rules</strong> for credit and document policy; this area is for customer-facing and dealer-facing form
        packages.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/rules">
          Rules
        </Link>
        <Link className="btn btn-secondary" href="/lender/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
