import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function SettingsProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/settings/profile");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Profile</h2>
      <p style={{ color: "var(--muted)" }}>User-level account details from your live workspace identity.</p>
      <div className="ds-form-grid">
        <label>
          Full name
          <input defaultValue={user?.name ?? session.user.name ?? ""} readOnly />
        </label>
        <label>
          Email
          <input defaultValue={user?.email ?? session.user.email ?? ""} readOnly />
        </label>
        <label>
          Role
          <input defaultValue={user?.role ?? session.user.role} readOnly />
        </label>
        <label>
          Member since
          <input defaultValue={user?.createdAt?.toLocaleDateString() ?? "—"} readOnly />
        </label>
      </div>
    </div>
  );
}
