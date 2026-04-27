import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealerLenderLinkService } from "@/lib/services/link.service";
import { prisma } from "@/lib/db";

export default async function DealerLendersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dealer/lenders");
  const dealerId = session.user.workspaceId;
  const links = await DealerLenderLinkService.getActiveLinksForDealer(dealerId);
  const lenders = await prisma.workspace.findMany({
    where: { type: "LENDER" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender Network</h1>
      <form
        action={async (fd) => {
          "use server";
          const fresh = await auth();
          if (!fresh?.user) redirect("/login?next=/dealer/lenders");
          const lenderId = String(fd.get("lenderId") || "");
          if (!lenderId) return;
          await DealerLenderLinkService.requestAccess(fresh.user.workspaceId, lenderId, fresh.user.id);
        }}
        className="card"
      >
        <p className="ds-card-title">Request Lender Access</p>
        <label>
          Lender
          <select name="lenderId" defaultValue="">
            <option value="" disabled>
              Select lender
            </option>
            {lenders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ marginTop: "0.6rem", width: "fit-content" }}>
          Request Access
        </button>
      </form>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Approved Links</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {links.map((l) => (
            <li key={l.id}>
              {l.lender.name} · {l.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
