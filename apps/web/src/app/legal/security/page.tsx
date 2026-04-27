export default function SecurityPage() {
  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem 2rem", color: "#e5e5e5", lineHeight: 1.7 }}>
      <h1 style={{ color: "#fff", marginBottom: "0.65rem" }}>Security</h1>
      <p style={{ marginTop: 0, color: "#cbd5e1" }}>
        DealSeal is built for high-assurance automotive finance operations. Our platform security model is designed to
        support industry-grade confidentiality, integrity, availability, and auditability requirements.
      </p>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0 }}>Platform Security Controls</h2>
        <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
          <li>
            <strong>Transport Security:</strong> TLS is enforced in production environments for data in transit between users,
            services, and integrations.
          </li>
          <li>
            <strong>Header Hardening:</strong> API traffic is protected with hardened HTTP security headers using Helmet,
            including HSTS in production.
          </li>
          <li>
            <strong>Access Control:</strong> JWT-based session authorization and scoped API key controls are used for protected
            endpoints and partner integrations.
          </li>
          <li>
            <strong>Rate Limiting:</strong> Configurable per-IP and per-API-key limits reduce abuse and protect service
            stability.
          </li>
          <li>
            <strong>CORS Policy:</strong> Production deployments require explicit allowlisted origins to prevent unintended
            cross-origin access.
          </li>
          <li>
            <strong>Auditability:</strong> Security-relevant and operational events are logged to support monitoring,
            investigation, and compliance workflows.
          </li>
        </ul>
      </section>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0 }}>Data Protection</h2>
        <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
          <li>
            <strong>Encryption in Transit:</strong> All external traffic is expected over HTTPS/TLS in production.
          </li>
          <li>
            <strong>Encryption at Rest:</strong> Production databases and storage services should use provider-managed at-rest
            encryption.
          </li>
          <li>
            <strong>Secrets Management:</strong> Sensitive configuration is managed via environment variables and deployment
            secret stores, not embedded in source code.
          </li>
          <li>
            <strong>Least Privilege:</strong> Service credentials and integration keys should be provisioned with the minimum
            required permissions.
          </li>
        </ul>
      </section>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0 }}>Application Integrity and Reliability</h2>
        <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
          <li>
            <strong>Validation Pipeline:</strong> CI enforces linting, type checks, and build verification before deployment.
          </li>
          <li>
            <strong>Operational Health:</strong> Dedicated health and readiness endpoints support proactive service monitoring.
          </li>
          <li>
            <strong>Controlled Releases:</strong> Production deployment requires environment validation and startup checks for
            critical security configuration.
          </li>
        </ul>
      </section>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0 }}>Security Program Direction</h2>
        <p style={{ color: "#cbd5e1", marginBottom: "0.55rem" }}>
          DealSeal continues to expand its security posture with controls expected by regulated financial workflows.
        </p>
        <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
          <li>Expanded threat detection, anomaly monitoring, and alerting coverage</li>
          <li>Regular dependency and vulnerability scanning with remediation SLAs</li>
          <li>Enhanced key rotation, credential governance, and access review processes</li>
          <li>Ongoing control mapping toward enterprise trust and compliance requirements</li>
        </ul>
      </section>
    </main>
  );
}
