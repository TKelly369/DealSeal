import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";

export default function VerificationPage() {
  return (
    <div className="ds-dashboard">
      <Section
        title="Verification & Audit Integrity"
        subtitle="Validate authoritative record identity, hash integrity, and version custody before relying on visual outputs."
      >
        <Card>
          <div className="ds-form-grid">
            <div className="ds-field">
              <label htmlFor="record-id">Record ID</label>
              <input id="record-id" defaultValue="REC-2026-004102" />
            </div>
            <div className="ds-field">
              <label htmlFor="record-hash">Record Hash</label>
              <input id="record-hash" defaultValue="sha256:3c1a8f5bd91e2f8c7a17f2aeb4069f1d264f..." />
            </div>
            <div className="ds-field">
              <label htmlFor="record-version">Version</label>
              <input id="record-version" defaultValue="v4" />
            </div>
          </div>
          <div className="ds-actions" style={{ marginTop: "var(--space-2)" }}>
            <Button>Verify Record</Button>
          </div>
        </Card>
      </Section>

      <Card>
        <p className="ds-card-panel__title">Mock Verification Result</p>
        <div className="ds-result-grid">
          <div className="ds-result-row">
            <span>Status</span>
            <span>Verified</span>
          </div>
          <div className="ds-result-row">
            <span>Hash Match</span>
            <span>Yes</span>
          </div>
          <div className="ds-result-row">
            <span>Version Match</span>
            <span>Yes</span>
          </div>
          <div className="ds-result-row">
            <span>System Custody</span>
            <span>Confirmed</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
