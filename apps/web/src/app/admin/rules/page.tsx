import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/rules");
  if (session.user.role !== "ADMIN" && session.user.role !== "PLATFORM_ADMIN") redirect("/dashboard");

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>State Rule Library</h2>
      <p style={{ color: "var(--muted)" }}>Maintain disclosures, fee ceilings, and lender-state constraints.</p>
      <form className="ds-form-grid">
        <label>
          State
          <input defaultValue="TX" />
        </label>
        <label>
          Max Doc Fee
          <input defaultValue="900" />
        </label>
        <label>
          Required Disclosure
          <input defaultValue="Retail Installment Truth-in-Lending" />
        </label>
        <button type="button" style={{ width: "fit-content", alignSelf: "end" }}>
          Save Rule
        </button>
      </form>
    </div>
  );
}
