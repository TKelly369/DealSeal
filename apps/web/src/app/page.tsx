import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

const highlights = [
  {
    title: "Authoritative Governing Record",
    detail:
      "One canonical contract record in DealSeal custody with version and hash continuity.",
  },
  {
    title: "Certified Visual Rendering",
    detail:
      "Uniform visual output generated from the governing record for external consumption.",
  },
  {
    title: "Verification & Audit Integrity",
    detail:
      "Record ID + hash validation with immutable event traceability across lifecycle events.",
  },
] as const;

export default function Home() {

  return (
    <div className="ds-dashboard">
      <Section
        title="DealSeal Transaction Authority Platform"
        subtitle="Enterprise contract verification and authority controls that preserve one uniform appearance while separating governing records, certified renderings, and convenience copies."
        actions={
          <>
            <Button href="/dashboard">Open Dashboard</Button>
            <Button href="/workspace" variant="secondary">
              Open Workspace
            </Button>
            <Button href="/verification" variant="secondary">
              Verify Contract
            </Button>
          </>
        }
      >
        <div className="ds-dashboard-grid">
          {highlights.map((item) => (
            <Card className="ds-card-panel" key={item.title}>
              <p className="ds-card-panel__title">{item.title}</p>
              <p className="ds-card-panel__body">{item.detail}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="ds-divider" />

      <Section
        title="Contract Verification System"
        subtitle="DealSeal provides auditable verification workflows for governing records, certified visual renderings, and downstream package operations."
      >
        <div className="ds-dashboard-grid ds-dashboard-grid--two">
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Verification Endpoint</p>
            <p className="ds-card-panel__body">
              Validate record identity, hash parity, and version status for lenders, dealers, and servicing operations.
            </p>
            <Button href="/verification" variant="secondary">
              Verify Now
            </Button>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Governance & Audit</p>
            <p className="ds-card-panel__body">
              Maintain end-to-end legal-grade audit integrity from record creation through rendering and verification events.
            </p>
            <Button href="/audit-trail" variant="secondary">
              View Audit Trail
            </Button>
          </Card>
        </div>
      </Section>
    </div>
  );
}
