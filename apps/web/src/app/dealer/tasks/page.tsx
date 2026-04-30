import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DealerTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/tasks");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Tasks</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        A unified task inbox (exceptions, compliance clears, lender requests) will list open items across deals. Today,
        open alerts and comments are visible inside each deal workspace.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/dealer/deals">
          Deals
        </Link>
        <Link className="btn btn-secondary" href="/dealer/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
