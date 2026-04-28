import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { FeedSkeleton, MetricCardSkeleton, TableSkeleton } from "@/components/shared/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDashboardMetrics } from "./actions";
import LiveDateTime24h from "../LiveDateTime24h";

async function OverviewMetrics() {
  const data = await getDashboardMetrics();
  const metrics = [
    { label: "Total Deals in Workspace", value: String(data.totalDeals), trend: "Live" },
    { label: "Recent Documents", value: String(data.recentDocuments), trend: "Live" },
    { label: "Active Lender Links", value: String(data.activeLenderLinks), trend: "Live" },
    { label: "Compliance Pass Rate", value: `${data.compliancePassRate}%`, trend: "Live" },
  ];
  return (
    <div className="ds-dashboard-metrics">
      {metrics.map((m) => (
        <Card key={m.label}>
          <p className="ds-card-title">{m.label}</p>
          <p style={{ fontSize: "2rem", margin: "0.3rem 0", fontWeight: 800 }}>{m.value}</p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{m.trend}</p>
        </Card>
      ))}
    </div>
  );
}

async function WorkflowsTable() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const workspaceId = session.user.workspaceId;
  let deals: Awaited<ReturnType<typeof prisma.deal.findMany>> = [];
  try {
    deals = await prisma.deal.findMany({
      where: { OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }] },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
  } catch (error) {
    console.error("[DealSeal] Workflows table fallback", error);
  }
  const rows = deals.map((d) => ({
    name: d.id,
    status: d.status,
    lastRun: d.updatedAt.toLocaleString(),
  }));
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="📂"
        title="No active workflows"
        description="Create your first workflow to begin orchestrating deal compliance."
        action={<Button href="/workspace">Create Workflow</Button>}
      />
    );
  }
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Active Workflows / Projects</h2>
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Status</TH>
            <TH>Last Run</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.name}>
              <TD>{r.name}</TD>
              <TD>
                <Badge>{r.status}</Badge>
              </TD>
              <TD>{r.lastRun}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

async function RecentActivityFeed() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const workspaceId = session.user.workspaceId;
  let items: Awaited<ReturnType<typeof prisma.notification.findMany>> = [];
  try {
    items = await prisma.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
  } catch (error) {
    console.error("[DealSeal] Activity feed fallback", error);
  }
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>Recent activity is temporarily unavailable.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
          {items.map((item) => (
            <li key={item.id} style={{ marginBottom: "0.45rem" }}>
              {item.title}: {item.message} - {item.createdAt.toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="ds-dashboard-page">
      <header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            marginBottom: "0.45rem",
          }}
        >
          <Image
            src="/brand/dealseal-user-logo.png"
            alt="DealSeal"
            width={240}
            height={240}
            priority
            style={{ height: "auto", width: "240px", borderRadius: 8 }}
          />
          <span style={{ textAlign: "center" }}>
            <LiveDateTime24h />
          </span>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/login?next=/admin" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
              Admin Login
            </Link>
            <Link href="/admin" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
              Admin Console
            </Link>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="ds-dashboard-metrics">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>
        }
      >
        <OverviewMetrics />
      </Suspense>

      <section className="ds-dashboard-main-grid">
        <Suspense fallback={<TableSkeleton />}>
          <WorkflowsTable />
        </Suspense>
        <Suspense fallback={<FeedSkeleton />}>
          <RecentActivityFeed />
        </Suspense>
      </section>

      <section className="ds-dashboard-bottom-grid">
        <Card>
          <h3 style={{ marginTop: 0 }}>Documents & Assets</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--text-secondary)" }}>
            <li>Retail Installment Contracts</li>
            <li>Funding Packets</li>
            <li>State Disclosure Addenda</li>
          </ul>
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>System Status</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--verified)" }}>●</span> All Systems Operational
          </p>
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>Billing & Account</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Pro Plan · 72% usage this cycle</p>
          <div className="ds-usage-bar" aria-hidden>
            <div />
          </div>
          <Link href="/settings/billing">Open Billing Settings</Link>
        </Card>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
        <div className="row">
          <Button href="/workspace">New Workflow</Button>
          <Button href="/documents" className="btn-secondary">
            Upload Document
          </Button>
          <Button href="/settings/workspace" className="btn-secondary">
            Invite Teammate
          </Button>
        </div>
      </section>
    </div>
  );
}
