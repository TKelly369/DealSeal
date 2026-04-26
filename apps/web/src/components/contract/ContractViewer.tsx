import { GoverningRecord } from "@/lib/demo-records";
import { CERTIFICATION_STATEMENT } from "@/lib/certification";

export type ContractViewerMode = "base" | "certified" | "non_authoritative";

export interface CertificationOverlayData {
  recordHash: string;
  renderingHash: string;
  timestamp: string;
  verificationUrl: string;
}

interface ContractViewerProps {
  record: GoverningRecord;
  mode: ContractViewerMode;
  overlayData?: CertificationOverlayData;
}

export function ContractViewer({ record, mode, overlayData }: ContractViewerProps) {
  const showCertifiedOverlay = mode === "certified" && overlayData;
  const showNonAuthoritative = mode === "non_authoritative";

  return (
    <section
      className="card"
      style={{
        position: "relative",
        overflow: "hidden",
        borderColor: showCertifiedOverlay ? "var(--brand-gold)" : "var(--border)",
      }}
    >
      {showCertifiedOverlay ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-26deg)",
            fontSize: "4rem",
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: "rgba(201, 162, 50, 0.18)",
            textAlign: "center",
          }}
        >
          CERTIFIED RENDERING
        </div>
      ) : null}

      <div style={{ position: "relative", zIndex: 1 }}>
        <header style={{ marginBottom: "1rem" }}>
          <p className="ds-card-title">Authoritative Governing Record</p>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.2rem" }}>{record.title}</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Parties: {record.parties} | Effective: {record.effectiveAt} | Version: {record.version}
          </p>
        </header>

        <article
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
            color: "var(--text)",
            fontSize: "0.96rem",
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          {record.body}
        </article>

        {showCertifiedOverlay ? (
          <div
            style={{
              border: "1px solid color-mix(in srgb, var(--brand-gold) 55%, var(--border))",
              borderRadius: "var(--radius-sm)",
              background: "var(--brand-gold-dim)",
              padding: "0.9rem",
            }}
          >
            <p className="ds-card-title" style={{ marginBottom: "0.6rem" }}>
              Certified Rendering Metadata
            </p>
            <dl className="ds-meta-grid">
              <dt>Record ID</dt>
              <dd>{record.id}</dd>
              <dt>Version</dt>
              <dd>{record.version}</dd>
              <dt>Record hash</dt>
              <dd>{overlayData.recordHash}</dd>
              <dt>Rendering hash</dt>
              <dd>{overlayData.renderingHash}</dd>
              <dt>Timestamp</dt>
              <dd>{overlayData.timestamp}</dd>
              <dt>Verification URL</dt>
              <dd>
                <a href={overlayData.verificationUrl}>{overlayData.verificationUrl}</a>
              </dd>
            </dl>
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
              {CERTIFICATION_STATEMENT}
            </p>
          </div>
        ) : null}

        {showNonAuthoritative ? (
          <p
            style={{
              margin: 0,
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid color-mix(in srgb, var(--warn-convenience) 45%, var(--border))",
              background: "var(--warning-surface)",
              color: "var(--warn-convenience)",
              fontWeight: 600,
            }}
          >
            This is a non-authoritative convenience copy. It does not independently establish control, ownership, or
            enforceability.
          </p>
        ) : null}
      </div>
    </section>
  );
}
