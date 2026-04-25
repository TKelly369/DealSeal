import Link from "next/link";
import { getDemoRecord } from "@/lib/demo-records";

type VerifyPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ hash?: string; renderingHash?: string }>;
};

function reasonList(reasons: string[]) {
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

  const reasons: string[] = [];
  if (!record) {
    reasons.push("Record does not exist.");
  }
  if (!hash) {
    reasons.push("Missing hash query parameter.");
  } else if (record && hash !== record.hash) {
    reasons.push("Provided hash does not match governing record hash.");
  }
  if (!renderingHash) {
    reasons.push("Missing renderingHash query parameter.");
  }

  const valid = reasons.length === 0;

  return (
    <main className="ds-verify-page">
      <section className="card ds-verify-panel">
        <h1>Verification Result</h1>
        <div className={valid ? "badge ds-badge--verified" : "badge ds-badge--error"}>
          {valid ? "VALID" : "INVALID"}
        </div>

        <dl className="ds-verify-grid">
          <div>
            <dt>Record exists</dt>
            <dd>{record ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>Hash match</dt>
            <dd>{record && hash === record.hash ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>Rendering hash received</dt>
            <dd>{renderingHash ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt>System custody</dt>
            <dd>{record ? "CONFIRMED" : "NOT CONFIRMED"}</dd>
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

        {reasonList(reasons)}

        <p className="ds-verify-actions">
          <Link href="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </p>
      </section>
    </main>
  );
}
