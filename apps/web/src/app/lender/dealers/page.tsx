import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export default async function LenderDealersPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/dealers");
  const lenderId = session.user.workspaceId;
  let links: Array<
    Awaited<ReturnType<typeof prisma.dealerLenderLink.findMany>>[number] & {
      dealer: { name: string };
    }
  > = [];
  let dataWarning: string | null = null;
  try {
    links = await prisma.dealerLenderLink.findMany({
      where: { lenderId },
      include: { dealer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("[DealSeal] lender dealers list unavailable", e);
    dataWarning = "Dealer links are temporarily unavailable.";
  }

  return (
    <div className="ds-section-shell">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Approved dealers</h1>
        <Link href="/lender/dealers/approval-queue" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Approval queue
        </Link>
      </div>
      <div className="card">
        {dataWarning ? <p style={{ color: "#fecaca" }}>{dataWarning}</p> : null}
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
                    if (!fresh?.user) redirect("/lender/login?next=/lender/dealers");
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
