import { BillingClient } from "./BillingClient";

export default function BillingPage() {
  return (
    <div>
      <h1>Billing dashboard</h1>
      <p className="badge" style={{ marginBottom: 12 }}>
        Set JWT in localStorage. POST /billing/tenant-plan, POST /billing/invoices/draft, GET
        /billing/usage, /events, /invoices, /plans.
      </p>
      <BillingClient />
    </div>
  );
}
