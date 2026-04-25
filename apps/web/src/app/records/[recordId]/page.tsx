import Link from "next/link";
import { getDemoRecord } from "@/lib/demo-records";
import { ContractViewer } from "@/components/contract/ContractViewer";
import { CertifiedRenderingActions } from "@/components/contract/CertifiedRenderingActions";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const record = getDemoRecord(recordId);

  if (!record) {
    return (
      <main className="ds-record-page">
        <section className="card ds-record-missing">
          <h1>Record Not Found</h1>
          <p>The requested governing record is unavailable in the current DealSeal demo dataset.</p>
          <Link href="/" className="btn btn-secondary">
            Return to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="ds-record-page">
      <header className="ds-record-header">
        <h1>Governing Record Detail</h1>
        <p>Authoritative record data and certified rendering controls.</p>
      </header>

      <section className="card ds-metadata-panel">
        <h3>Record Metadata</h3>
        <dl>
          <div>
            <dt>Record ID</dt>
            <dd>{record.id}</dd>
          </div>
          <div>
            <dt>Deal ID</dt>
            <dd>{record.dealId}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{record.version}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{record.status}</dd>
          </div>
          <div>
            <dt>Record Hash</dt>
            <dd className="ds-mono">{record.hash}</dd>
          </div>
          <div>
            <dt>Locked At</dt>
            <dd>{new Date(record.lockedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="ds-viewer-shell">
        <ContractViewer record={record} mode="BASE" />
      </section>

      <CertifiedRenderingActions record={record} />
    </main>
  );
}
