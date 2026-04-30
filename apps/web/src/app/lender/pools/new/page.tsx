import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoanPoolType } from "@/generated/prisma";
import { getWorkspaceType } from "@/lib/onboarding-status";
import { createLoanPoolAction } from "@/app/lender/pools/actions";

export default async function NewLoanPoolPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/pools/new");
  const ws = await getWorkspaceType(session.user.workspaceId);
  if (ws !== "LENDER") redirect("/dashboard");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Create loan pool</h1>
      <Link href="/lender/pools" className="btn btn-secondary">
        Back
      </Link>
      <form
        action={createLoanPoolAction}
        style={{ marginTop: "1rem", maxWidth: "28rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <label>
          Pool name
          <input name="poolName" required className="ds-input" />
        </label>
        <label>
          Pool segment (lender taxonomy)
          <select name="poolType" className="ds-input" defaultValue={LoanPoolType.PRIME}>
            {Object.values(LoanPoolType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description (optional)
          <textarea name="description" className="ds-input" rows={3} />
        </label>
        <label>
          Target size (# loans)
          <input name="targetSize" type="number" min={1} defaultValue={100} className="ds-input" />
        </label>
        <button type="submit" className="btn">
          Create draft pool
        </button>
      </form>
    </div>
  );
}
