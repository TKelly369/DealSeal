import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import {
  classifyCreditTier,
  gradeDealerForLender,
  gradeLenderSegment,
  isJacketCompleteForDeal,
  type GradedDealerForLender,
  type GradedLenderForDealer,
  type MarketSegment,
} from "@/lib/counterparty-performance-grades";

const DEFAULT_WINDOW_DAYS = 90;

function windowStart(days: number = DEFAULT_WINDOW_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type DealForPerf = {
  id: string;
  dealerId: string;
  lenderId: string;
  status: string;
  complianceStatus: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  parties: { creditTier: string | null }[];
  financials: { amountFinanced: Prisma.Decimal } | null;
  generatedDocuments: { documentType: string | null }[];
  _count: {
    amendments: number;
    alerts: number;
  };
};

function emptyDealerSignals(
  dealerId: string,
  dealerName: string,
  primaryState: string,
  operatingStates: string[],
): Parameters<typeof gradeDealerForLender>[0] {
  return {
    dealerId,
    dealerName,
    primaryState,
    operatingStates,
    dealCount: 0,
    consummatedCount: 0,
    openPipelineCount: 0,
    blockedComplianceCount: 0,
    openCriticalAlerts: 0,
    openWarningAlerts: 0,
    totalAmendments: 0,
    jacketCompleteConsummated: 0,
    consummatedCycleHoursSum: 0,
  };
}

type PerfAccumulator = Parameters<typeof gradeDealerForLender>[0] | Parameters<typeof gradeLenderSegment>[0];

function accumulateDeal(acc: PerfAccumulator, deal: DealForPerf, openCrit: number, openWarn: number) {
  acc.dealCount += 1;
  const isConsummated = deal.status === "CONSUMMATED";
  const isOpenPipeline = !isConsummated;
  if (isOpenPipeline) acc.openPipelineCount += 1;
  if (isOpenPipeline && deal.complianceStatus === "BLOCKED") acc.blockedComplianceCount += 1;
  if (isConsummated) {
    acc.consummatedCount += 1;
    const hours = (deal.updatedAt.getTime() - deal.createdAt.getTime()) / 36e5;
    acc.consummatedCycleHoursSum += Math.max(0, hours);
    const types = deal.generatedDocuments.map((d) => d.documentType);
    if (isJacketCompleteForDeal(types)) acc.jacketCompleteConsummated += 1;
  }
  acc.openCriticalAlerts += openCrit;
  acc.openWarningAlerts += openWarn;
  acc.totalAmendments += deal._count.amendments;
  if ("segmentDealCount" in acc) acc.segmentDealCount += 1;
}

/** Lender book: graded approved dealers (geo + “preferred” tier for sourcing). */
export async function listGradedDealersForLender(
  lenderWorkspaceId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<{ rows: GradedDealerForLender[]; warning: string | null }> {
  const since = windowStart(windowDays);
  try {
    const links = await prisma.dealerLenderLink.findMany({
      where: { lenderId: lenderWorkspaceId, status: "APPROVED" },
      select: {
        dealerId: true,
        dealer: {
          select: {
            name: true,
            dealerProfile: {
              select: { operatingStates: true, stateOfFormation: true },
            },
          },
        },
      },
    });

    const deals = (await prisma.deal.findMany({
      where: { lenderId: lenderWorkspaceId, createdAt: { gte: since } },
      select: {
        id: true,
        dealerId: true,
        lenderId: true,
        status: true,
        complianceStatus: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        parties: { select: { creditTier: true }, take: 3 },
        financials: { select: { amountFinanced: true } },
        generatedDocuments: { select: { documentType: true } },
        _count: {
          select: {
            amendments: true,
            alerts: { where: { status: "OPEN", severity: "CRITICAL" } },
          },
        },
      },
    })) as unknown as DealForPerf[];

    const alertWarnCounts = await prisma.dealAlert.groupBy({
      by: ["dealId"],
      where: { status: "OPEN", severity: "WARNING" },
      _count: { _all: true },
    });
    const warnByDeal = new Map(alertWarnCounts.map((g) => [g.dealId, g._count._all]));

    const critAmendDeals = await prisma.deal.findMany({
      where: { lenderId: lenderWorkspaceId, createdAt: { gte: since } },
      select: {
        id: true,
        _count: {
          select: {
            amendments: true,
            alerts: { where: { status: "OPEN", severity: "CRITICAL" } },
          },
        },
      },
    });
    const critByDeal = new Map(critAmendDeals.map((d) => [d.id, d._count.alerts]));
    const amendByDeal = new Map(critAmendDeals.map((d) => [d.id, d._count.amendments]));

    const byDealer = new Map<string, Parameters<typeof gradeDealerForLender>[0]>();

    for (const link of links) {
      const profile = link.dealer.dealerProfile;
      const op = profile?.operatingStates?.length ? profile.operatingStates : [];
      const primary = op[0] ?? profile?.stateOfFormation ?? "—";
      byDealer.set(
        link.dealerId,
        emptyDealerSignals(link.dealerId, link.dealer.name, primary, op),
      );
    }

    for (const deal of deals) {
      let acc = byDealer.get(deal.dealerId);
      if (!acc) {
        const w = await prisma.workspace.findUnique({
          where: { id: deal.dealerId },
          select: {
            name: true,
            dealerProfile: { select: { operatingStates: true, stateOfFormation: true } },
          },
        });
        const op = w?.dealerProfile?.operatingStates ?? [];
        const primary = op[0] ?? w?.dealerProfile?.stateOfFormation ?? deal.state;
        acc = emptyDealerSignals(deal.dealerId, w?.name ?? "Dealer", primary, op);
        byDealer.set(deal.dealerId, acc);
      }
      const openCrit = critByDeal.get(deal.id) ?? 0;
      const openWarn = warnByDeal.get(deal.id) ?? 0;
      const amend = amendByDeal.get(deal.id) ?? deal._count.amendments;
      accumulateDeal(acc, { ...deal, _count: { amendments: amend, alerts: deal._count.alerts } }, openCrit, openWarn);
    }

    const rows = [...byDealer.values()]
      .map((s) => gradeDealerForLender(s))
      .sort((a, b) => b.overallScore - a.overallScore || b.dealCount - a.dealCount);

    return { rows, warning: null };
  } catch (e) {
    console.error("[DealSeal] listGradedDealersForLender", e);
    return { rows: [], warning: "Partner grades are temporarily unavailable (database)." };
  }
}

function emptyLenderSegment(
  lenderId: string,
  lenderName: string,
  licensedStates: string[],
  segment: MarketSegment,
): Parameters<typeof gradeLenderSegment>[0] {
  return {
    lenderId,
    lenderName,
    licensedStates,
    dealCount: 0,
    consummatedCount: 0,
    openPipelineCount: 0,
    blockedComplianceCount: 0,
    openCriticalAlerts: 0,
    openWarningAlerts: 0,
    totalAmendments: 0,
    jacketCompleteConsummated: 0,
    consummatedCycleHoursSum: 0,
    segment,
    segmentDealCount: 0,
  };
}

/** Dealer view: each approved lender broken out by market segment (prime / subprime / mixed). */
export async function listGradedLendersForDealer(
  dealerWorkspaceId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<{ rows: GradedLenderForDealer[]; warning: string | null }> {
  const since = windowStart(windowDays);
  try {
    const links = await prisma.dealerLenderLink.findMany({
      where: { dealerId: dealerWorkspaceId, status: "APPROVED" },
      select: {
        lenderId: true,
        lender: {
          select: {
            name: true,
            lenderProfile: { select: { licensedStates: true } },
          },
        },
      },
    });

    const deals = (await prisma.deal.findMany({
      where: { dealerId: dealerWorkspaceId, createdAt: { gte: since } },
      select: {
        id: true,
        dealerId: true,
        lenderId: true,
        status: true,
        complianceStatus: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        parties: { select: { creditTier: true }, take: 3 },
        financials: { select: { amountFinanced: true } },
        generatedDocuments: { select: { documentType: true } },
        _count: {
          select: {
            amendments: true,
            alerts: { where: { status: "OPEN", severity: "CRITICAL" } },
          },
        },
      },
    })) as unknown as DealForPerf[];

    const alertWarnCounts = await prisma.dealAlert.groupBy({
      by: ["dealId"],
      where: { status: "OPEN", severity: "WARNING" },
      _count: { _all: true },
    });
    const warnByDeal = new Map(alertWarnCounts.map((g) => [g.dealId, g._count._all]));

    const meta = await prisma.deal.findMany({
      where: { dealerId: dealerWorkspaceId, createdAt: { gte: since } },
      select: {
        id: true,
        _count: {
          select: {
            amendments: true,
            alerts: { where: { status: "OPEN", severity: "CRITICAL" } },
          },
        },
      },
    });
    const critByDeal = new Map(meta.map((d) => [d.id, d._count.alerts]));
    const amendByDeal = new Map(meta.map((d) => [d.id, d._count.amendments]));

    const segments: MarketSegment[] = ["PRIME", "SUBPRIME", "UNKNOWN"];
    const key = (lenderId: string, seg: MarketSegment) => `${lenderId}::${seg}`;
    const accum = new Map<string, Parameters<typeof gradeLenderSegment>[0]>();

    for (const link of links) {
      const licensed = link.lender.lenderProfile?.licensedStates ?? [];
      for (const seg of segments) {
        accum.set(key(link.lenderId, seg), emptyLenderSegment(link.lenderId, link.lender.name, licensed, seg));
      }
    }

    for (const deal of deals) {
      const partyTier = deal.parties[0]?.creditTier ?? null;
      const amt = deal.financials?.amountFinanced != null ? Number(deal.financials.amountFinanced) : null;
      const seg = classifyCreditTier(partyTier, amt);

      const openCrit = critByDeal.get(deal.id) ?? 0;
      const openWarn = warnByDeal.get(deal.id) ?? 0;
      const amend = amendByDeal.get(deal.id) ?? deal._count.amendments;
      const dealRow = { ...deal, _count: { amendments: amend, alerts: deal._count.alerts } };

      let bucket = accum.get(key(deal.lenderId, seg));
      if (!bucket) {
        const w = await prisma.workspace.findUnique({
          where: { id: deal.lenderId },
          select: { name: true, lenderProfile: { select: { licensedStates: true } } },
        });
        bucket = emptyLenderSegment(
          deal.lenderId,
          w?.name ?? "Lender",
          w?.lenderProfile?.licensedStates ?? [],
          seg,
        );
        accum.set(key(deal.lenderId, seg), bucket);
      }
      accumulateDeal(bucket, dealRow, openCrit, openWarn);
    }

    const byLender = new Map<string, GradedLenderForDealer>();
    for (const link of links) {
      const licensed = link.lender.lenderProfile?.licensedStates ?? [];
      const segs = segments
        .map((seg) => {
          const raw = accum.get(key(link.lenderId, seg));
          if (!raw || raw.segmentDealCount === 0) return null;
          return gradeLenderSegment(raw);
        })
        .filter(Boolean) as GradedLenderForDealer["bySegment"];

      segs.sort((a, b) => b.overallScore - a.overallScore);

      byLender.set(link.lenderId, {
        lenderId: link.lenderId,
        lenderName: link.lender.name,
        licensedStates: licensed,
        bySegment: segs,
      });
    }

    const rows = [...byLender.values()].sort(
      (a, b) =>
        Math.max(0, ...a.bySegment.map((x) => x.overallScore)) -
        Math.max(0, ...b.bySegment.map((x) => x.overallScore)),
    );

    return { rows, warning: null };
  } catch (e) {
    console.error("[DealSeal] listGradedLendersForDealer", e);
    return { rows: [], warning: "Partner grades are temporarily unavailable (database)." };
  }
}
