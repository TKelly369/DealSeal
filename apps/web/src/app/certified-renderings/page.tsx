import { ActionButton } from "@/components/ActionButton";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

export default function CertifiedRenderingsPage() {
  return (
    <section className="ds-stack">
      <PageHeader
        kicker="Certified Output"
        title="Certified Renderings"
        subtitle="Generate and distribute tamper-evident Certified Renderings from Authoritative Governing Records with complete rendering lineage."
      />
      <div className="ds-grid ds-grid--three">
        <StatCard
          title="Certified Renderings (30d)"
          value="1,124"
          tone="verification"
          detail="Files produced through the certification overlay pipeline."
        />
        <StatCard
          title="Non-Authoritative Copies"
          value="296"
          tone="warning"
          detail="Convenience copies generated for read-only distribution."
        />
        <StatCard
          title="Distribution Channels"
          value="9"
          detail="Connected lender and servicing destinations receiving outputs."
        />
      </div>
      <div className="ds-actions">
        <ActionButton href="/workspace">Create Certified Rendering</ActionButton>
        <ActionButton href="/workspace" variant="secondary">
          Produce Non-Authoritative Copy
        </ActionButton>
      </div>
    </section>
  );
}
