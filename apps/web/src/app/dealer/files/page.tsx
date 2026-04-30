import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DealerFilesPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/files");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Files</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Deal-scoped uploads and generated packages live under each deal&apos;s <strong>Documents</strong> step. Use
        global documents for workspace-level artifacts.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/dealer/deals">
          Deals
        </Link>
        <Link className="btn btn-secondary" href="/documents">
          Workspace documents
        </Link>
      </div>
    </div>
  );
}
