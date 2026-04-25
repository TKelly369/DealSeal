import Link from "next/link";
import { getDemoRecord } from "@/lib/demo-records";

function VerificationBadge({ valid }: { valid: boolean }) {
  return <span className={valid ? "ds-badge-verified" : "ds-badge-invalid"}>{valid ? "VALID" : "INVALID"}</span>;
}

type VerifyPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ hash?: string; renderingHash?: string }>;
};

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { recordId: raw } = await params;
  const { hash: suppliedHash, renderingHash } = await searchParams;
  const recordId = decodeURIComponent(raw);
  const record = getDemoRecord(recordId);
  const resolvedRecordId = record?.id ?? recordId;
  const hashMatch = Boolean(record && suppliedHash && suppliedHash === record.hash);
  const valid = Boolean(record && hashMatch && renderingHash);
  const timestamp = record?.lockedAt ?? new Date().toISOString();
  const version = record?.version ?? 0;
  const displayHash = record?.hash ?? suppliedHash ?? "";

  return (
    <div className="ds-dashboard">
      <div className="ds-card ds-verify-card">
        <h1 className="ds-section__title">Rendering Verification</h1>
        <p className="ds-section__subtitle">
          Independent verification of authoritative custody and rendering integrity for DealSeal records.
        </p>

        <div className="ds-verify-badge-row">
          <VerificationBadge valid={valid} />
        </div>

        <div className="ds-verify-status-grid">
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Record exists</p>
            <p className="ds-verify-status-item__value">{record ? "Confirmed" : "Not found"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Hash match confirmed</p>
            <p className="ds-verify-status-item__value">{hashMatch ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Rendering hash received</p>
            <p className="ds-verify-status-item__value">{renderingHash ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">System custody confirmed</p>
            <p className="ds-verify-status-item__value">{record ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Record ID</p>
            <p className="ds-verify-status-item__value">{resolvedRecordId}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Version</p>
            <p className="ds-verify-status-item__value">{version}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Timestamp</p>
            <p className="ds-verify-status-item__value">{new Date(timestamp).toLocaleString()}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Rendering Hash</p>
            <p className="ds-verify-status-item__value ds-table__mono">{renderingHash ?? "—"}</p>
          </div>
        </div>

        <div className="ds-verify-links">
          <p className="ds-card-panel__title">Canonical verification URL</p>
          <p className="ds-card-panel__body">
            <a
              href={`https://dealseal1.com/verify/${encodeURIComponent(resolvedRecordId)}?hash=${encodeURIComponent(
                displayHash,
              )}&renderingHash=${encodeURIComponent(renderingHash ?? "")}`}
              target="_blank"
              rel="noreferrer"
            >
              {`https://dealseal1.com/verify/${resolvedRecordId}`}
            </a>
          </p>
          <p className="ds-verify-links__back">
            <Link href="/" className="ds-ui-button ds-ui-button--secondary">
              Return to dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
