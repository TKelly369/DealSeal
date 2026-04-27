import { redirect } from "next/navigation";
import { getUsers } from "@/app/admin/actions";
import { auth } from "@/lib/auth";
import { UserAdminRoleSchema } from "@/lib/types";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; role?: string; search?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const role =
    sp.role === "ALL" || UserAdminRoleSchema.safeParse(sp.role).success
      ? ((sp.role || "ALL") as "ALL" | "DEALER" | "LENDER" | "ADMIN")
      : "ALL";
  const search = (sp.search || "").trim();
  const data = await getUsers({ page, limit: 10, role, search });

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <form method="GET" className="card" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ marginTop: 0 }}>User Directory Filters</h2>
        <div className="ds-form-grid">
          <label>
            Role
            <select name="role" defaultValue={role}>
              <option value="ALL">All</option>
              <option value="DEALER">Dealer</option>
              <option value="LENDER">Lender</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label>
            Search
            <input name="search" defaultValue={search} placeholder="Name, email, workspace..." />
          </label>
        </div>
        <button type="submit" style={{ width: "fit-content" }}>
          Apply Filters
        </button>
      </form>
      <UsersTable rows={data.rows} page={data.page} pageCount={data.pageCount} total={data.total} role={role} search={search} />
      {data.rows.length === 0 ? <TableSkeleton /> : null}
    </div>
  );
}
