import Link from "next/link";
import { getDemoRecord } from "@/lib/demo-records";

type VerifyPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ hash?: string; renderingHash?: string }>;
};

function FailureReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return null;
  }
  return (
    <ul className="ds-verify-reasons">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { recordId } = await params;
  const { hash, renderingHash } = await searchParams;
  const record = getDemoRecord(recordId);

  const checks = {
    recordExists: Boolean(record),
    hashMatch: Boolean(record && hash && hash === record.hash),
    renderingHashReceived: Boolean(renderingHash),
  };
  const valid = checks.recordExists && checks.hashMatch && checks.renderingHashReceived;

  const reasons: string[] = [];
  if (!checks.recordExists) reasons.push("Record exists check failed.");
  if (!checks.hashMatch) reasons.push("Hash match check failed.");
  if (!checks.renderingHashReceived) reasons.push("Rendering hash received check failed.");

  return (
    <main className="ds-verify-page">
      <section className="card ds-verify-panel">
        <h1>Rendering Verification</h1>
        <div className={valid ? "badge ds-badge--verified" : "badge ds-badge--error"}>
          {valid ? "VALID" : "INVALID"}
        </div>

        <dl className="ds-verify-grid">
          <div>
            <dt>Record exists</dt>
            <dd>{checks.recordExists ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>Hash match</dt>
            <dd>{checks.hashMatch ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>Rendering hash received</dt>
            <dd>{checks.renderingHashReceived ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>System custody</dt>
            <dd>{checks.recordExists ? "CONFIRMED" : "NOT CONFIRMED"}</dd>
          </div>
          <div>
            <dt>Record ID</dt>
            <dd>{recordId}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{record?.version ?? "—"}</dd>
          </div>
          <div>
            <dt>Record Hash</dt>
            <dd className="ds-mono">{record?.hash ?? "—"}</dd>
          </div>
          <div>
            <dt>Rendering Hash</dt>
            <dd className="ds-mono">{renderingHash ?? "—"}</dd>
          </div>
        </dl>

        <FailureReasons reasons={reasons} />

        <p className="ds-verify-actions">
          <Link href="/" className="btn btn-secondary">
            Return to Dashboard
          </Link>
        </p>
      </section>
    </main>
  );
}
