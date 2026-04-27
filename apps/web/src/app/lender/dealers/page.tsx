import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export default async function LenderDealersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/dealers");
  const lenderId = session.user.workspaceId;
  const links = await prisma.dealerLenderLink.findMany({
    where: { lenderId },
    include: { dealer: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Approved Dealers</h1>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {links.map((link) => (
            <li key={link.id} style={{ marginBottom: "0.4rem" }}>
              {link.dealer.name} · {link.status}
              {link.status === "PENDING" ? (
                <form
                  style={{ display: "inline", marginLeft: "0.6rem" }}
                  action={async () => {
                    "use server";
                    const fresh = await auth();
                    if (!fresh?.user) redirect("/login?next=/lender/dealers");
                    await DealerLenderLinkService.approveAccess(link.id, fresh.user.id);
                  }}
                >
                  <button type="submit">Approve</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
