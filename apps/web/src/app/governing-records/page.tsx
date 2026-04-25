import { PageHeader } from "@/components/PageHeader";
import { ActionButton } from "@/components/ActionButton";
import { StatCard } from "@/components/StatCard";

export default function GoverningRecordsPage() {
  return (
    <div className="ds-stack">
      <PageHeader
        kicker="Records"
        title="Authoritative Governing Record Registry"
        subtitle="System Custody tracks canonical contract state, append-only transitions, and enterprise signing lineage."
        actions={
          <>
            <ActionButton href="/workspace">Open Deal Workspace</ActionButton>
            <ActionButton href="/audit" variant="secondary">
              Review Audit Integrity
            </ActionButton>
          </>
        }
      />
      <section className="ds-stat-grid">
        <StatCard
          title="Active Governing Records"
          value="248"
          detail="Canonical records held under organizational custody and lifecycle controls."
          tone="default"
        />
        <StatCard
          title="Locked to System Custody"
          value="232"
          detail="Records preserved with immutable state lineage and policy enforcement."
          tone="success"
        />
        <StatCard
          title="Pending Compliance Review"
          value="16"
          detail="Records flagged for legal or servicing validation before certification."
          tone="warning"
        />
      </section>
    </div>
  );
}
