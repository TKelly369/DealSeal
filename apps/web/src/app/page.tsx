import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

const stats = [
  { label: "Total Contracts", value: "1,248", icon: "TX" },
  { label: "Certified Renderings", value: "4,892", icon: "CR" },
  { label: "Verification Requests", value: "9,604", icon: "VR" },
  { label: "Active Deals", value: "312", icon: "AD" },
];

export default function Home() {
  return (
    <div className="ds-dashboard">
      <Section
        title="DealSeal Platform"
        subtitle="Authoritative Contract System"
        actions={
          <>
            <Button href="/workspace">Create Contract</Button>
            <Button href="/verify/test" variant="secondary">
              Verify Record
            </Button>
          </>
        }
      >
        <div className="ds-dashboard-grid">
          {stats.map((stat) => (
            <Card className="ds-stat-card" key={stat.label}>
              <div className="ds-stat-card__top">
                <span className="ds-stat-card__label">{stat.label}</span>
                <span className="ds-stat-card__icon" aria-hidden>
                  {stat.icon}
                </span>
              </div>
              <p className="ds-stat-card__value">{stat.value}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="ds-divider" />

      <Section
        title="Operational Readiness"
        subtitle="Track custody, verification, and package distribution workflows with consistent enterprise controls."
      >
        <div className="ds-dashboard-grid ds-dashboard-grid--two">
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Audit Integrity</p>
            <p className="ds-card-panel__body">
              Review immutable event history for governing record transitions and institutional sign-off chains.
            </p>
            <Button href="/audit" variant="secondary">
              Open Audit Trail
            </Button>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Verification Endpoint</p>
            <p className="ds-card-panel__body">
              Confirm authoritative status and certified rendering lineage for external counterparties.
            </p>
            <Button href="/verification" variant="secondary">
              Open Verification
            </Button>
          </Card>
        </div>
      </Section>
    </div>
  );
}
