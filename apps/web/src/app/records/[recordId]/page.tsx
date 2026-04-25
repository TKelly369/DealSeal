import { notFound } from "next/navigation";
import { getDemoRecord } from "@/lib/demo-records";
import { RecordDetailClient } from "./record-detail-client";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const record = getDemoRecord(recordId);
  if (!record) {
    notFound();
  }

  return (
    <main className="ds-record-page">
      <header className="ds-record-header">
        <h1>Governing Record</h1>
        <p>Authoritative record details and certified rendering workflow.</p>
      </header>

      <div className="ds-record-grid">
        <section className="card ds-metadata-panel">
          <h3>Metadata</h3>
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

        <RecordDetailClient record={record} />
      </div>

    </main>
  );
}
