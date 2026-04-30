import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LenderRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/rules");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender Rule Configuration</h1>
      <form className="card ds-form-grid">
        <label>
          Max LTV %
          <input defaultValue="90" />
        </label>
        <label>
          Allowed Vehicle Age (years)
          <input defaultValue="10" />
        </label>
        <label>
          Required Documents
          <input defaultValue="Contract, Disclosure, Funding Packet" />
        </label>
        <label>
          State Restrictions
          <input defaultValue="TX, FL, AZ" />
        </label>
        <button type="button" style={{ width: "fit-content", alignSelf: "end" }}>
          Save Rules
        </button>
      </form>
    </div>
  );
}
