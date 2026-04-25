import Link from "next/link";
import { verifyRecord } from "@/lib/api";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

async function fetchVerify(recordId: string): Promise<VerifyResponse> {
  try {
    return (await verifyRecord(recordId)) as VerifyResponse;
  } catch {
    return {
      code: "UNAVAILABLE",
      valid: false,
      hashMatch: false,
      version: 0,
      timestamp: new Date(0).toISOString(),
    };
  }
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (status === "VERIFIED") return <span className="badge ds-badge--verified">VERIFIED</span>;
  if (status === "INVALID") return <span className="badge ds-badge--error">INVALID</span>;
  return <span className="badge">{status}</span>;
}

type VerifyResponse = {
  valid: boolean;
  hashMatch: boolean;
  version: number;
  timestamp: string;
  recordId?: string;
  recordHash?: string;
  status?: string;
  code?: string;
};

function NotFound() {
  return (
    <div className="ds-verify">
      <h1>Verification</h1>
      <p className="ds-verify__lead">DealSeal verification endpoint</p>
      <div className="card">
        <p className="ds-card-title">Not found</p>
        <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>Record not found.</p>
        <p style={{ marginTop: "1rem" }}>
          <Link className="btn btn-secondary" href="/">
            Return home
          </Link>
        </p>
      </div>
      <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>
        Verify URL:{" "}
        <a href="https://dealseal1.com/verify" target="_blank" rel="noreferrer">
          https://dealseal1.com/verify
        </a>
      </p>
    </div>
  );
}

function InvalidIdMessage() {
  return (
    <div className="ds-verify">
      <h1>Verification</h1>
      <p className="ds-verify__lead">A valid governing record ID is required (UUID format).</p>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          <Link href="/">Return home</Link>.
        </p>
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="ds-verify">
      <h1>Verification unavailable</h1>
      <p className="ds-verify__lead">The verification service could not be reached. Try again later.</p>
    </div>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId: raw } = await params;
  const recordId = decodeURIComponent(raw);

  if (!isUuid(recordId)) {
    return <InvalidIdMessage />;
  }

  const data = await fetchVerify(recordId);
  if (!data) {
    return <Unavailable />;
  }
  if (!data.recordId) {
    return <NotFound />;
  }

  const status = data.valid && data.hashMatch ? "VERIFIED" : "INVALID";

  return (
    <div className="ds-verify">
      <h1>Record Verification</h1>
      <p className="ds-verify__lead">
        Independent verification of authoritative contract custody and rendering authenticity.
      </p>
      <p style={{ marginBottom: "1rem" }}>
        <StatusBadge status={status} />
      </p>
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="ds-card-title">Verification Result</p>
        <dl className="ds-meta-grid">
          <dt>Record ID</dt>
          <dd>{data.recordId ?? "—"}</dd>
          <dt>Status</dt>
          <dd>{status}</dd>
          <dt>Hash match</dt>
          <dd>{data.hashMatch ? "Yes" : "No"}</dd>
          <dt>Version</dt>
          <dd>{data.version}</dd>
          <dt>Timestamp</dt>
          <dd>{new Date(data.timestamp).toLocaleString()}</dd>
        </dl>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p className="ds-card-title">Record hash (SHA-256)</p>
        <div className="ds-hash">{data.recordHash ?? "—"}</div>
      </div>
      <p style={{ color: "var(--text-secondary)", marginTop: "1rem" }}>
        Canonical verification URL:{" "}
        <a href={`https://dealseal1.com/verify/${recordId}`} target="_blank" rel="noreferrer">
          {`https://dealseal1.com/verify/${recordId}`}
        </a>
      </p>
    </div>
  );
}
