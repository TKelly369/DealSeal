import Link from "next/link";
import { auth } from "@/lib/auth";
import type { DealComplianceStatus, DealStatus } from "@/generated/prisma";
import { DocumentType } from "@/generated/prisma";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  INTAKE_FILTERS,
  countByIntakeFilter,
  dealMatchesIntakeFilter,
  normalizeIntakeFilter,
  type IntakeDealFilterRow,
  type IntakeFilterKey,
} from "@/lib/lender-intake-filters";

function formatStatus(status: DealStatus): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function complianceDot(status: DealComplianceStatus): { label: string; color: string } {
  switch (status) {
    case "BLOCKED":
      return { label: "Blocked", color: "#f87171" };
    case "WARNING":
      return { label: "Warning", color: "#facc15" };
    default:
      return { label: "Compliant", color: "#4ade80" };
  }
}

function needsLenderAttention(args: {
  status: DealStatus;
  pendingAmendments: number;
}): boolean {
  if (args.pendingAmendments > 0) return true;
  return (
    args.status === "RISC_UNSIGNED_REVIEW" ||
    args.status === "RISC_LENDER_FINAL" ||
    args.status === "LENDER_REVIEW" ||
    args.status === "MOCKUP_SUBMITTED" ||
    args.status === "LENDER_FINAL_APPROVAL" ||
    args.status === "AWAITING_FUNDING_UPLOAD"
  );
}

function intakePriority(args: {
  status: DealStatus;
  pendingAmendments: number;
  complianceStatus: DealComplianceStatus;
}): number {
  let p = 0;
  if (args.pendingAmendments > 0) p += 100;
  if (args.status === "RISC_UNSIGNED_REVIEW" || args.status === "RISC_LENDER_FINAL") p += 80;
  if (args.status === "LENDER_REVIEW" || args.status === "MOCKUP_SUBMITTED") p += 70;
  if (args.status === "AWAITING_FUNDING_UPLOAD") p += 60;
  if (args.complianceStatus === "BLOCKED") p += 50;
  if (args.complianceStatus === "WARNING") p += 25;
  return p;
}

export type LenderIntakeQueueDeal = IntakeDealFilterRow & {
  id: string;
  state: string;
  updatedAt: Date;
  dealer: { name: string };
  vehicle: { year: number; make: string; model: string } | null;
  amendments: { id: string }[];
};

export default async function LenderDealIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/deal-intake");
  const lenderId = session.user.workspaceId;
  const { filter: rawFilter } = await searchParams;
  const activeFilter = normalizeIntakeFilter(rawFilter);

  let deals: LenderIntakeQueueDeal[] = [];
  let dataWarning: string | null = null;

  try {
    deals = await fetchIntakeDeals(lenderId);
  } catch (e) {
    console.error("[DealSeal] Lender deal-intake queue", e);
    dataWarning = "Could not load the intake queue. Try again shortly.";
  }

  const now = Date.now();
  const filterCounts = countByIntakeFilter(deals, now);
  const filtered = deals.filter((d) => dealMatchesIntakeFilter(d, activeFilter, now));

  const attention = deals.filter((d) =>
    needsLenderAttention({ status: d.status, pendingAmendments: d.amendments.length }),
  );
  const blocked = deals.filter((d) => d.complianceStatus === "BLOCKED").length;

  const sorted = [...filtered].sort((a, b) => {
    const pa = intakePriority({
      status: a.status,
      pendingAmendments: a.amendments.length,
      complianceStatus: a.complianceStatus,
    });
    const pb = intakePriority({
      status: b.status,
      pendingAmendments: b.amendments.length,
      complianceStatus: b.complianceStatus,
    });
    if (pb !== pa) return pb - pa;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
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
        <div>
          <h1 style={{ marginTop: 0, marginBottom: "0.35rem" }}>Deal intake queue</h1>
          <p style={{ margin: 0, color: "var(--muted)", maxWidth: 640, fontSize: "0.92rem" }}>
            Filter by lifecycle and risk signals. Priority sorts pending amendments and RISC stages first within the
            active filter.
          </p>
        </div>
        <Link href="/lender/dashboard" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Dashboard
        </Link>
      </div>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="ds-card-title" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          Filters
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
          {INTAKE_FILTERS.map((f) => {
            const active = f.key === activeFilter;
            const count = filterCounts[f.key];
            const href =
              f.key === "all" ? "/lender/deal-intake" : `/lender/deal-intake?filter=${encodeURIComponent(f.key)}`;
            return (
              <Link
                key={f.key}
                href={href}
                className={active ? "btn" : "btn btn-secondary"}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
                aria-current={active ? "page" : undefined}
              >
                {f.label}
                <span style={{ opacity: 0.85, marginLeft: "0.35rem" }}>({count})</span>
              </Link>
            );
          })}
        </div>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
          <strong>New</strong>: created in the last 14 days. <strong>Green-light</strong>: compliant and in structuring /
          green / first-green. <strong>Missing credit</strong>: buyer credit tier empty (excl. disclosure stage).{" "}
          <strong>Missing disclosure</strong>: no accepted initial disclosure or still in disclosure required.{" "}
          <strong>Missing signature</strong>: RISC review/final stages, or post-RISC without executed RISC / signed doc.{" "}
          <strong>Pending funding</strong>: generating or ready closing package.
        </p>
      </div>

      <div
        className="ds-dashboard-bottom-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          marginTop: "1.25rem",
        }}
      >
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            In queue
          </p>
          <h2 style={{ margin: "0.25rem 0 0" }}>{deals.length}</h2>
        </div>
        <div className="card" style={{ borderLeft: "3px solid #fdba74" }}>
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Needs lender action
          </p>
          <h2 style={{ margin: "0.25rem 0 0" }}>{attention.length}</h2>
        </div>
        <div className="card" style={{ borderLeft: "3px solid #f87171" }}>
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Compliance blocked
          </p>
          <h2 style={{ margin: "0.25rem 0 0" }}>{blocked}</h2>
        </div>
        <div className="card" style={{ borderLeft: "3px solid #38bdf8" }}>
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Showing (filter)
          </p>
          <h2 style={{ margin: "0.25rem 0 0" }}>{filtered.length}</h2>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.25rem", overflowX: "auto" }}>
        {dataWarning ? (
          <p style={{ color: "#f87171", marginTop: 0 }}>{dataWarning}</p>
        ) : deals.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No deals in your book yet. When dealers submit to your program, they will appear here.
          </p>
        ) : sorted.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No deals match <strong>{INTAKE_FILTERS.find((f) => f.key === activeFilter)?.label}</strong>. Try another
            filter or <Link href="/lender/deal-intake">clear filters</Link>.
          </p>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Deal</th>
                <th>Dealer</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>State</th>
                <th>Compliance</th>
                <th>Amendments</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((deal) => {
                const attn = needsLenderAttention({
                  status: deal.status,
                  pendingAmendments: deal.amendments.length,
                });
                const pri = intakePriority({
                  status: deal.status,
                  pendingAmendments: deal.amendments.length,
                  complianceStatus: deal.complianceStatus,
                });
                const comp = complianceDot(deal.complianceStatus);
                const v = deal.vehicle;
                const vehicleLabel = v ? `${v.year} ${v.make} ${v.model}` : "—";
                const shortId = deal.id.length > 12 ? `${deal.id.slice(0, 10)}…` : deal.id;
                return (
                  <tr key={deal.id}>
                    <td>
                      {pri > 0 ? (
                        <span style={{ fontWeight: 700, color: attn ? "#fdba74" : "var(--muted)" }}>{pri}</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: "0.82rem" }} title={deal.id}>
                        {shortId}
                      </code>
                    </td>
                    <td>{deal.dealer.name}</td>
                    <td style={{ fontSize: "0.88rem", color: "var(--text-secondary)", maxWidth: 200 }}>{vehicleLabel}</td>
                    <td style={{ fontSize: "0.88rem" }}>{formatStatus(deal.status)}</td>
                    <td>{deal.state}</td>
                    <td>
                      <span style={{ color: comp.color, fontSize: "0.85rem", fontWeight: 600 }}>{comp.label}</span>
                    </td>
                    <td>
                      {deal.amendments.length > 0 ? (
                        <span style={{ color: "#fdba74", fontWeight: 600 }}>Pending ({deal.amendments.length})</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {deal.updatedAt.toLocaleString()}
                    </td>
                    <td>
                      <Link
                        href={intakeDetailHref(deal.id, activeFilter)}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function intakeDetailHref(dealId: string, filter: IntakeFilterKey): string {
  if (filter === "all") return `/lender/deal-intake/${dealId}`;
  return `/lender/deal-intake/${dealId}?filter=${encodeURIComponent(filter)}`;
}

async function fetchIntakeDeals(lenderId: string): Promise<LenderIntakeQueueDeal[]> {
  const rows = await prisma.deal.findMany({
    where: { lenderId },
    select: {
      id: true,
      status: true,
      state: true,
      complianceStatus: true,
      createdAt: true,
      updatedAt: true,
      initialDisclosureAcceptedAt: true,
      dealer: { select: { name: true } },
      vehicle: { select: { year: true, make: true, model: true } },
      parties: { where: { role: "BUYER" }, select: { creditTier: true } },
      authoritativeContract: { select: { signatureStatus: true } },
      amendments: { where: { status: "PENDING_LENDER_APPROVAL" }, select: { id: true } },
      generatedDocuments: {
        where: { documentType: DocumentType.RISC_SIGNED },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(({ generatedDocuments, ...rest }) => ({
    ...rest,
    riscSignedDocs: generatedDocuments,
  }));
}
