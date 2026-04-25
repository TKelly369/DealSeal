import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
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
        <Card className="ds-stat-card">
          <p className="ds-stat-card__value">1,248</p>
          <p className="ds-stat-card__label">Total Contracts</p>
        </Card>
        <Card className="ds-stat-card">
          <p className="ds-stat-card__value">4,892</p>
          <p className="ds-stat-card__label">Certified Renderings</p>
        </Card>
        <Card className="ds-stat-card">
          <p className="ds-stat-card__value">9,604</p>
          <p className="ds-stat-card__label">Verification Requests</p>
        </Card>
        <Card className="ds-stat-card">
          <p className="ds-stat-card__value">312</p>
          <p className="ds-stat-card__label">Active Deals</p>
        </Card>
      </div>
    </Section>
  );
}
