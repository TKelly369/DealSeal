import Link from "next/link";
import { CERTIFICATION_STATEMENT, computeRecordHash, computeRenderingHash } from "@/lib/certification";
import { getDemoRecordById } from "@/lib/demo-records";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ hash?: string; renderingHash?: string; timestamp?: string }>;
}) {
  const { recordId: raw } = await params;
  const { hash, renderingHash, timestamp } = await searchParams;
  const recordId = decodeURIComponent(raw);
  const record = getDemoRecordById(recordId);

  if (!record) {
    return (
      <div className="ds-verify">
        <h1>Verification result</h1>
        <p className="ds-verify__lead">The requested governing record could not be found.</p>
        <Link className="btn btn-secondary" href="/">
          Return to dashboard
        </Link>
      </div>
    );
  }

  const expectedRecordHash = computeRecordHash(record);
  const expectedRenderingHash = computeRenderingHash(record, "certified");
  const valid = hash === expectedRecordHash && renderingHash === expectedRenderingHash;
  const statusText = valid ? "VALID" : "INVALID";

  return (
    <div className="ds-verify">
      <h1>Verification result</h1>
      <p className="ds-verify__lead">Public proof that this certified rendering matches the authoritative record.</p>

      <p style={{ marginBottom: "1rem" }}>
        <span className={`badge ${valid ? "ds-badge--verified" : "ds-badge--error"}`}>{statusText}</span>
      </p>

      <div className="card">
        <p className="ds-card-title">Record Details</p>
        <dl className="ds-meta-grid">
          <dt>Record ID</dt>
          <dd>{record.id}</dd>
          <dt>Title</dt>
          <dd>{record.title}</dd>
          <dt>Parties</dt>
          <dd>{record.parties}</dd>
          <dt>Timestamp</dt>
          <dd>{timestamp ?? "Not provided"}</dd>
          <dt>Expected record hash</dt>
          <dd>{expectedRecordHash}</dd>
          <dt>Expected rendering hash</dt>
          <dd>{expectedRenderingHash}</dd>
          <dt>Provided record hash</dt>
          <dd>{hash ?? "Not provided"}</dd>
          <dt>Provided rendering hash</dt>
          <dd>{renderingHash ?? "Not provided"}</dd>
        </dl>
      </div>

      <p
        style={{
          marginTop: "1rem",
          padding: "0.9rem 1rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid color-mix(in srgb, var(--brand-gold) 50%, var(--border))",
          background: "var(--brand-gold-dim)",
          color: "var(--text-secondary)",
        }}
      >
        {CERTIFICATION_STATEMENT}
      </p>
    </div>
  );
}
