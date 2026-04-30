import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export default async function LenderDealerApprovalQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/dealers/approval-queue");
  const lenderId = session.user.workspaceId;
  const pending = await prisma.dealerLenderLink.findMany({
    where: { lenderId, status: "PENDING" },
    include: { dealer: { select: { name: true, id: true } } },
    orderBy: { updatedAt: "desc" },
  });

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
        <h1 style={{ marginTop: 0 }}>Dealer approval queue</h1>
        <Link href="/lender/dealers" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          All dealers
        </Link>
      </div>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Pending dealer–lender link requests appear here. Approve to allow that dealership to submit deals to your
        program.
      </p>
      <div className="card">
        {pending.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No pending approvals.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {pending.map((link) => (
              <li key={link.id} style={{ marginBottom: "0.75rem" }}>
                <strong>{link.dealer.name}</strong> · requested · {link.updatedAt.toLocaleString()}
                <form
                  style={{ display: "inline", marginLeft: "0.6rem" }}
                  action={async () => {
                    "use server";
                    const fresh = await auth();
                    if (!fresh?.user) redirect("/lender/login?next=/lender/dealers/approval-queue");
                    await DealerLenderLinkService.approveAccess(link.id, fresh.user.id);
                  }}
                >
                  <button type="submit" className="btn" style={{ fontSize: "0.85rem" }}>
                    Approve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
