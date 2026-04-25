import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DownloadRenderingButtons } from "@/components/DownloadRenderingButtons";
import { Section } from "@/components/ui/Section";
import { getGoverningRecords } from "@/lib/api";

export default async function CertifiedRenderingsPage() {
  let latestRecordId: string | null = null;
  try {
    const records = await getGoverningRecords();
    latestRecordId = records[0]?.id ?? null;
  } catch {
    latestRecordId = null;
  }

  return (
    <div className="ds-dashboard">
      <Section
        title="Certified Visual Renderings"
        subtitle="Generate visual contract outputs with uniform appearance and verifiable lineage from the Authoritative Governing Record."
        actions={
          <Button href="/workspace">Generate Certified Rendering</Button>
        }
      >
        <div className="ds-dashboard-grid">
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">PDF Rendering</p>
            <p className="ds-card-panel__body">
              Standards-grade PDF output for institutional transfer, archival, and lender servicing workflows.
            </p>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">JPEG / PNG Rendering</p>
            <p className="ds-card-panel__body">
              Certified visual images for downstream channels requiring image-first evidence representation.
            </p>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">QR Verification</p>
            <p className="ds-card-panel__body">
              Encodes record ID + verification endpoint for instant authenticity checks without exposing raw payloads.
            </p>
          </Card>
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Rendering Hash</p>
            <p className="ds-card-panel__body">
              Cryptographic digest of the rendered artifact aligned to governing record state and version lineage.
            </p>
          </Card>
        </div>
      </Section>

      <Card className="ds-card-panel">
        <p className="ds-card-panel__title">Certification Notice</p>
        <p className="ds-card-panel__body">
          This document is a Certified Visual Rendering generated from the Authoritative Governing Record maintained in
          DealSeal. The authoritative record remains in system custody. This rendering is verifiable via Record ID and
          hash.
        </p>
      </Card>

      {latestRecordId ? (
        <Card className="ds-card-panel">
          <p className="ds-card-panel__title">Download outputs</p>
          <p className="ds-card-panel__body">
            Generate PDF artifacts from the same authoritative template with mode-specific overlays.
          </p>
          <DownloadRenderingButtons governingRecordId={latestRecordId} />
        </Card>
      ) : null}
    </div>
  );
}
