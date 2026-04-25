import { BrandLogo } from "@/components/BrandLogo";
import { ActionButton } from "@/components/ActionButton";
import { StatCard } from "@/components/StatCard";

export default function Home() {
  return (
    <div className="ds-stack">
      <section className="card ds-hero-enterprise">
        <div className="ds-hero-enterprise__content">
          <div style={{ marginBottom: "0.9rem" }}>
            <BrandLogo variant="hero" href={null} />
          </div>
          <p className="ds-card-title">DealSeal Enterprise Platform</p>
          <h1 style={{ margin: "0 0 0.55rem", fontSize: "clamp(1.6rem, 2.8vw, 2.35rem)" }}>
            Authoritative Contract Infrastructure
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: 78 * 8 }}>
            Establish System Custody for every Authoritative Governing Record, produce Certified Renderings with
            immutable Audit Integrity, and expose a reliable Verification Endpoint for enterprise counterparties.
          </p>
          <div className="ds-actions ds-actions--spacious">
            <ActionButton href="/workspace">Create Deal</ActionButton>
            <ActionButton href="/verify/test" variant="secondary">
              Verify Record
            </ActionButton>
            <ActionButton href="/documents" variant="ghost">
              Download Certified Rendering
            </ActionButton>
          </div>
        </div>
      </section>

      <section className="ds-stat-grid" aria-label="System status">
        <StatCard
          title="Governing Records"
          value="1,248"
          detail="Authoritative Governing Record instances under active custody."
          tone="default"
        />
        <StatCard
          title="Certified Renderings"
          value="4,892"
          detail="Certified Rendering outputs issued with chain-of-custody proofs."
          tone="success"
        />
        <StatCard
          title="Non-Authoritative Copies"
          value="317"
          detail="Convenience documents generated with explicit non-authoritative labeling."
          tone="warning"
        />
        <StatCard
          title="Verification Requests"
          value="9,604"
          detail="Verification Endpoint checks served for lenders and servicing teams."
          tone="default"
        />
      </section>
    </div>
  );
}
