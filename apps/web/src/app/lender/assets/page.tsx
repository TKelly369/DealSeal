import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AssetsClient, type AssetRow, type PoolOption } from "./AssetsClient";

export default async function LenderAssetsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/assets");

  const lenderId = session.user.workspaceId;

  const [deals, pools] = await Promise.all([
    prisma.deal.findMany({
      where: { lenderId },
      include: {
        parties: true,
        financials: true,
        loanPool: true,
        contractTransactionEvents: { orderBy: { transactionDate: "asc" } },
        instrumentTransferEvents: { orderBy: { transferDate: "asc" } },
        negotiableInstrument: true,
        custodyEvents: { orderBy: { timestamp: "asc" } },
        amendments: {
          where: { status: "PENDING_LENDER_APPROVAL" },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.loanPool.findMany({
      where: { lenderId, status: { in: ["FORMING", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const actorUserIds = Array.from(
    new Set(
      deals.flatMap((d) => d.custodyEvents.map((e) => e.actorUserId)).filter((id): id is string => Boolean(id)),
    ),
  );
  const users = actorUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const rows: AssetRow[] = deals.map((d) => {
    const buyer = d.parties.find((p) => p.role === "BUYER");
    return {
      id: d.id,
      buyerName: buyer ? `${buyer.firstName} ${buyer.lastName}` : "—",
      amountFinanced: d.financials ? Number(d.financials.amountFinanced) : null,
      grade: d.secondaryMarketGrade,
      secondaryMarketStatus: d.secondaryMarketStatus,
      poolId: d.poolId,
      poolName: d.loanPool?.poolName ?? null,
      events: d.contractTransactionEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        transactionDate: e.transactionDate.toISOString(),
        fromEntityId: e.fromEntityId,
        toEntityId: e.toEntityId,
      })),
      pendingAmendments: d.amendments.map((a) => ({
        id: a.id,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
      instrument: d.negotiableInstrument
        ? {
            id: d.negotiableInstrument.id,
            payToOrderOf: d.negotiableInstrument.payToOrderOf,
            eNoteControlLocation: d.negotiableInstrument.eNoteControlLocation,
            hdcStatus: d.negotiableInstrument.hdcStatus,
            hdcDefects: Array.isArray(d.negotiableInstrument.hdcDefects)
              ? (d.negotiableInstrument.hdcDefects as string[])
              : [],
          }
        : null,
      instrumentEvents: d.instrumentTransferEvents.map((e) => ({
        id: e.id,
        transferType: e.transferType,
        transferDate: e.transferDate.toISOString(),
        fromEntityId: e.fromEntityId,
        toEntityId: e.toEntityId,
        endorsementLanguage: e.endorsementLanguage,
      })),
      activityEvents: d.custodyEvents.map((e) => {
        const actor = userById.get(e.actorUserId);
        return {
          id: e.id,
          eventType: e.eventType,
          timestamp: e.timestamp.toISOString(),
          actorRole: e.actorRole,
          actorUserId: e.actorUserId,
          actorName: actor?.name ?? null,
          actorEmail: actor?.email ?? null,
        };
      }),
    };
  });

  const poolOptions: PoolOption[] = pools.map((p) => ({
    id: p.id,
    poolName: p.poolName,
    poolType: p.poolType,
    status: p.status,
  }));

  return <AssetsClient deals={rows} pools={poolOptions} />;
}
