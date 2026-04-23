import { AdminClient } from "./AdminClient";

export default function AdminPage() {
  return (
    <div>
      <h1>Admin console</h1>
      <p className="badge" style={{ marginBottom: 12 }}>
        ADMIN role · holds, pricing, lenders, state logs, usage.
      </p>
      <AdminClient />
    </div>
  );
}
