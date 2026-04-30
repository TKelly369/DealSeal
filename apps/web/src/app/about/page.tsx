export default function AboutPage() {
  const shellStyle = {
    maxWidth: 980,
    margin: "2rem auto",
    padding: "0 1rem 2.5rem",
    color: "var(--text)",
    lineHeight: 1.65,
    fontFamily: "var(--font)",
  } as const;

  const cardStyle = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "1.4rem",
    background: "linear-gradient(180deg, #0e0e0e 0%, #111111 100%)",
  } as const;

  const sectionTitleStyle = {
    margin: "0 0 0.6rem",
    fontSize: "1.2rem",
    color: "#ffffff",
    letterSpacing: "0.01em",
    fontWeight: 600,
  } as const;

  const bodyTextStyle = {
    margin: "0 0 0.75rem",
    color: "var(--text-secondary)",
  } as const;

  const bodyListStyle = {
    margin: 0,
    paddingLeft: "1.1rem",
    color: "var(--text-secondary)",
  } as const;

  const dividerStyle = {
    height: 1,
    background: "linear-gradient(90deg, transparent, var(--border-bright), transparent)",
    margin: "1.2rem 0",
  } as const;

  return (
    <main style={shellStyle}>
      <section style={cardStyle}>
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.75rem",
          }}
        >
          About DealSeal
        </p>
        <h1
          style={{
            color: "#fff",
            margin: "0.5rem 0 0.85rem",
            fontSize: "clamp(1.7rem, 4vw, 2.35rem)",
            lineHeight: 1.2,
          }}
        >
          Contract Infrastructure for Auto Finance
        </h1>
        <p style={{ ...bodyTextStyle, marginBottom: "0.8rem" }}>
          DealSeal provides a contract-first operating layer for automotive finance teams that need accuracy, traceability,
          and enforceability across the full transaction lifecycle.
        </p>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          The platform standardizes deal structure at origination, synchronizes terms across documents, and preserves an
          auditable source of truth through funding and servicing.
        </p>
      </section>

      <div style={dividerStyle} />

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>What We Solve</h2>
        <p style={bodyTextStyle}>
          Many auto-finance workflows still depend on fragmented document packages and manual reconciliation between dealer,
          lender, and compliance teams.
        </p>
        <ul style={bodyListStyle}>
          <li>Inconsistent contract data between forms and systems</li>
          <li>Funding delays caused by preventable package defects</li>
          <li>Higher repurchase, exception, and litigation exposure</li>
          <li>Limited downstream confidence in document integrity</li>
        </ul>
      </section>

      <div style={dividerStyle} />

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>How DealSeal Works</h2>
        <ul style={{ ...bodyListStyle, marginBottom: "0.85rem" }}>
          <li>Applies rules-based structuring for jurisdiction and lender policy alignment</li>
          <li>Generates synchronized, compliant deal documentation from a single contract baseline</li>
          <li>Maintains certified outputs and verification pathways for defensible recordkeeping</li>
          <li>Supports operational controls with audit-ready event history</li>
        </ul>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          The result is a reliable process where every material term maps back to one authoritative record.
        </p>
      </section>

      <div style={dividerStyle} />

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Core Platform Systems</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.9rem",
            marginBottom: "0.85rem",
          }}
        >
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.85rem 0.95rem", background: "#0c0c0c" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem", color: "#fff" }}>Deal Builder</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              The dealer execution platform used to structure, assemble, submit, and close deals correctly with guided
              compliance and workflow controls.
            </p>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.85rem 0.95rem", background: "#0c0c0c" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem", color: "#fff" }}>Deal Scan</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              The intake and verification platform used for document upload, scan, and indexing into the DealSeal system for
              audit-ready traceability.
            </p>
          </div>
        </div>
        <p style={bodyTextStyle}>
          These components are designed as integrated system architecture with workflow and verification methods across
          deal assembly and deal-scanning operations.
        </p>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          The Document Generator AI Agent is also a core system function, producing synchronized contract packages and related
          artifacts from authoritative deal data.
        </p>
      </section>

      <div style={dividerStyle} />

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Value for Dealers and Lenders</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.9rem",
          }}
        >
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.85rem 0.95rem", background: "#0c0c0c" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem", color: "#fff" }}>For Dealers</h3>
            <ul style={{ margin: 0, paddingLeft: "1.05rem", color: "var(--text-secondary)" }}>
              <li>Cleaner submissions and faster funding confidence</li>
              <li>Lower avoidable rework across front and back office</li>
              <li>More consistent execution across stores and teams</li>
            </ul>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.85rem 0.95rem", background: "#0c0c0c" }}>
            <h3 style={{ margin: "0 0 0.45rem", fontSize: "1rem", color: "#fff" }}>For Lenders</h3>
            <ul style={{ margin: 0, paddingLeft: "1.05rem", color: "var(--text-secondary)" }}>
              <li>Stronger pre-funding validation and package quality</li>
              <li>Better enforcement posture with consistent documentation</li>
              <li>Reduced lifecycle risk from contract-level discrepancies</li>
            </ul>
          </div>
        </div>
      </section>

      <div style={dividerStyle} />

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Mission</h2>
        <p style={{ ...bodyTextStyle, marginBottom: "0.7rem" }}>
          DealSeal&apos;s mission is to establish transaction certainty in auto finance through enforceable, standardized, and
          verifiable contract infrastructure.
        </p>
        <p style={{ margin: 0, fontWeight: 600, color: "#ffffff" }}>
          Every deal. Verified, aligned, and enforceable by design.
        </p>
      </section>
    </main>
  );
}
