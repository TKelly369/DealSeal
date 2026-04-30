import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LenderFilesPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/files");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Files</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Deal collateral, funding packages, and lender-held documents are attached to each deal in{" "}
        <strong>Deal intake</strong>. Use workspace documents for program-level artifacts.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn btn-secondary" href="/documents">
          Workspace documents
        </Link>
      </div>
    </div>
  );
}
