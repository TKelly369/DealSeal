import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LenderTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/tasks");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Tasks</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        A unified lender task inbox (RISC reviews, stipulations, funding checks) will aggregate open items across deals.
        Today, workflow status and comments live under each deal in Deal intake.
      </p>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn btn-secondary" href="/lender/calendar">
          Calendar
        </Link>
      </div>
    </div>
  );
}
