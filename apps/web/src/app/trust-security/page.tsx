export default function TrustSecurityPage() {
  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>DealSeal Trust & Security</h1>
      <p style={{ color: "var(--muted)", maxWidth: 920 }}>
        DealSeal is designed to protect consumer, dealer, lender, and transaction data with enterprise-grade security,
        privacy, and compliance controls across access management, encryption, availability, processing integrity, and
        auditability.
      </p>

      <div className="card">
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Security overview</h2>
        <ul>
          <li>Role-based access control and least-privilege access segregation.</li>
          <li>Audit logging for critical system, document, and workflow actions.</li>
          <li>Immutable document and package integrity checks with hash references.</li>
          <li>Security and compliance governance via internal control center.</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Encryption & privacy</h2>
        <ul>
          <li>Encryption in transit via TLS and secure API authentication patterns.</li>
          <li>Encryption-at-rest and sensitive-record protection controls by design.</li>
          <li>Policy-driven retention and privacy request workflows for governed records.</li>
          <li>Access to confidential records is restricted, logged, and reviewable.</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Availability & resilience</h2>
        <ul>
          <li>Operational monitoring, incident handling, and recovery validation records.</li>
          <li>Backup verification and disaster-recovery evidence tracking support.</li>
          <li>Document and transaction preservation controls for legal and audit continuity.</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Compliance roadmap</h2>
        <p style={{ marginBottom: 0 }}>
          DealSeal is designed to support SOC 2 Type II readiness and enterprise-grade security controls. SOC 2
          attestation will be obtained through an independent auditor once the required observation period and audit
          process are completed.
        </p>
      </div>

      <p style={{ marginTop: "1rem", color: "var(--muted)" }}>
        Incident reporting and trust inquiries: <a href="mailto:security@dealseal1.com">security@dealseal1.com</a>
      </p>
    </div>
  );
}
