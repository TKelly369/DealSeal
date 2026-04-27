import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function SettingsWorkspacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/settings/workspace");
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: { name: true, slug: true, type: true, createdAt: true },
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Workspace</h2>
      <p style={{ color: "var(--muted)" }}>Workspace-level identity and policy metadata from the live database.</p>
      <div className="ds-form-grid">
        <label>
          Workspace name
          <input defaultValue={workspace?.name ?? "—"} readOnly />
        </label>
        <label>
          Workspace slug
          <input defaultValue={workspace?.slug ?? "—"} readOnly />
        </label>
        <label>
          Workspace type
          <input defaultValue={workspace?.type ?? "—"} readOnly />
        </label>
        <label>
          Created
          <input defaultValue={workspace?.createdAt?.toLocaleDateString() ?? "—"} readOnly />
        </label>
      </div>
    </div>
  );
}
