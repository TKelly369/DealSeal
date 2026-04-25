import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { demoRecords } from "@/lib/demo-records";

export default function Home() {
  return (
    <div className="ds-dashboard">
      <Section
        title="DealSeal"
        subtitle="Authoritative Contract Infrastructure"
      >
        <Card className="ds-card-panel">
          <p className="ds-card-panel__title">Control Center</p>
          <p className="ds-card-panel__body">
            Governing records, certified rendering generation, and verification
            workflows from a single authority dashboard.
          </p>
        </Card>
      </Section>

      <Section
        title="Recent Governing Records"
        subtitle="Demo record available for the production verification flow."
      >
        <div className="ds-dashboard-grid ds-dashboard-grid--two">
          {demoRecords.map((record) => (
            <Card key={record.id} className="ds-card-panel">
              <p className="ds-card-panel__title">{record.id}</p>
              <p className="ds-card-panel__body">Deal ID: {record.dealId}</p>
              <p className="ds-card-panel__body">Version: {record.version}</p>
              <p className="ds-card-panel__body">Status: {record.status}</p>
              <p className="ds-card-panel__body">
                Hash: <span className="ds-table__mono">{record.hash.slice(0, 16)}...</span>
              </p>
              <div className="ds-table__actions">
                <Button href={`/records/${record.id}`}>Open Record</Button>
                <Link
                  href={`/verify/${record.id}?hash=${encodeURIComponent(record.hash)}`}
                  className="ds-ui-button ds-ui-button--secondary"
                >
                  Verify
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
