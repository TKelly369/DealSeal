import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

const stats = [
  { label: "Authoritative Governing Records", value: "1,248", icon: "GR" },
  { label: "Certified Visual Renderings", value: "4,892", icon: "CV" },
  { label: "Non-Authoritative Convenience Copies", value: "317", icon: "NC" },
  { label: "Verification & Audit Integrity", value: "9,604", icon: "VA" },
];

export default function Home() {
  return (
    <div className="ds-dashboard">
      <Section
        title="Authoritative Contract Infrastructure"
        subtitle="DealSeal separates the governing record, certified visual renderings, and non-authoritative convenience copies while preserving one uniform contract appearance."
        actions={
          <>
            <Button href="/workspace">Create Deal</Button>
            <Button href="/verification" variant="secondary">
              Verify Record
            </Button>
            <Button href="/certified-renderings" variant="secondary">
              Generate Certified Rendering
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
              <p className="ds-stat-card__description">System custody and chain-of-appearance controls active.</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="ds-divider" />

      <Section
        title="Contract Authority Control Center"
        subtitle="Coordinate governing records, certified renderings, convenience-copy controls, and verification workflows from a single enterprise command surface."
      >
        <div className="ds-dashboard-grid ds-dashboard-grid--two">
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Authoritative Governing Record</p>
            <p className="ds-card-panel__body">
              Canonical contract payloads remain in system custody with version lineage, lock status, and hash continuity.
            </p>
            <Button href="/governing-records" variant="secondary">
              Open Governing Records
            </Button>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Certified Visual Rendering</p>
            <p className="ds-card-panel__body">
              Generate certified PDF/image outputs that preserve visual parity while proving authoritative source lineage.
            </p>
            <Button href="/certified-renderings" variant="secondary">
              Manage Renderings
            </Button>
          </Card>
        </div>
      </Section>
    </div>
  );
}
