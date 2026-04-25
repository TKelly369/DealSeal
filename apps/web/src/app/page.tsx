import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { getDashboardMetrics } from "@/lib/api";

const metricCards = [
  { key: "totalContracts", label: "Total Contracts", icon: "TC" },
  { key: "certifiedRenderings", label: "Certified Renderings", icon: "CR" },
  { key: "verificationRequests", label: "Verification Requests", icon: "VR" },
  { key: "activeDeals", label: "Active Deals", icon: "AD" },
] as const;

export default async function Home() {
  let metrics: Awaited<ReturnType<typeof getDashboardMetrics>> | null = null;
  let metricsError: string | null = null;

  try {
    metrics = await getDashboardMetrics();
  } catch (e) {
    metricsError = e instanceof Error ? e.message : "Unable to load dashboard metrics";
  }

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
          {metricCards.map((stat) => {
            const value = metrics ? metrics[stat.key] : "—";
            return (
              <Card className="ds-stat-card" key={stat.label}>
                <div className="ds-stat-card__top">
                  <span className="ds-stat-card__label">{stat.label}</span>
                  <span className="ds-stat-card__icon" aria-hidden>
                    {stat.icon}
                  </span>
                </div>
                <p className="ds-stat-card__value">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </p>
                <p className="ds-stat-card__description">
                  {metrics
                    ? "Live metrics from DealSeal system custody services."
                    : "Metrics unavailable. Showing safe fallback while API recovers."}
                </p>
              </Card>
            );
          })}
        </div>
        {metricsError ? (
          <p className="ds-inline-warning">
            Unable to load dashboard metrics: {metricsError}
          </p>
        ) : null}
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
