export default function AboutPage() {
  return (
    <main style={{ maxWidth: 980, margin: "2rem auto", padding: "0 1rem 2rem", color: "#e5e5e5", lineHeight: 1.75 }}>
      <section
        style={{
          border: "1px solid #262626",
          borderRadius: 14,
          padding: "1.4rem 1.2rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #121212 100%)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.33)",
        }}
      >
        <p style={{ margin: 0, color: "#dc2626", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.75rem" }}>
          About DealSeal
        </p>
        <h1 style={{ color: "#fff", margin: "0.5rem 0 0.8rem", fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)" }}>
          Contract-Centric Infrastructure for Auto Finance
        </h1>
        <p style={{ margin: 0 }}>
          DealSeal is a next-generation infrastructure platform redefining how auto-finance transactions are structured,
          documented, and enforced.
        </p>
        <p>
          At its core, DealSeal solves a systemic industry problem: inconsistent contracts, fragmented documentation, and
          costly compliance failures that expose both dealers and lenders to unnecessary risk.
        </p>
        <div
          style={{
            marginTop: "0.9rem",
            borderLeft: "4px solid #dc2626",
            padding: "0.6rem 0.75rem",
            background: "rgba(220,38,38,0.08)",
            borderRadius: 8,
          }}
        >
          <strong>
            Every deal must originate from a legally enforceable, authoritative contract-and everything else must follow
            from it.
          </strong>
        </div>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Built for Dealers: Precision at the Point of Sale</h2>
        <p>
          For dealers, DealSeal transforms the deal-making process from manual and error-prone into guided, compliant
          execution.
        </p>
        <p>Through AI-driven onboarding and state-specific logic, the platform:</p>
        <ul>
          <li>Structures each deal according to applicable laws and lender requirements</li>
          <li>Automatically generates compliant contracts and required forms</li>
          <li>Ensures all numbers, taxes, and terms are consistent across every document</li>
          <li>Eliminates paperwork errors that lead to funding delays or buybacks</li>
        </ul>
        <p>DealSeal does not just help dealers complete deals-it ensures they are done correctly the first time.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.55rem" }}>
          {["Faster funding", "Fewer rejected deals", "Reduced liability", "Increased operational confidence"].map((item) => (
            <div key={item} style={{ border: "1px solid #2f2f2f", borderRadius: 8, padding: "0.5rem 0.6rem", background: "#0f0f0f" }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Built for Lenders: Enforceability and Risk Control</h2>
        <p>For lenders, DealSeal delivers something the industry has historically lacked: true contract certainty.</p>
        <p>Every deal funded through DealSeal is built on:</p>
        <ul>
          <li>A verified authoritative contract</li>
          <li>A complete and traceable chain of custody</li>
          <li>Consistent, system-controlled documentation across all deal artifacts</li>
        </ul>
        <p>This structure strengthens a lender&apos;s position across the entire lifecycle:</p>
        <ul>
          <li>Origination: Confidence in deal integrity before funding</li>
          <li>Servicing: Clean, consistent records</li>
          <li>Enforcement: Legally defensible documentation in repossession, replevin, or litigation</li>
        </ul>
        <p>By eliminating discrepancies and documentation gaps, DealSeal reduces buybacks, legal disputes, enforcement failures, and operational friction.</p>
        <p>It transforms contract risk into contract reliability.</p>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>The Infrastructure Layer the Industry Has Been Missing</h2>
        <p>DealSeal is not just a document generator-it is a compliance and enforcement infrastructure.</p>
        <p>Our platform integrates:</p>
        <ul>
          <li>AI-driven deal structuring based on jurisdiction and lender rules</li>
          <li>Real-time compliance checkpoints before deal finalization</li>
          <li>Authoritative contract standardization aligned with UCC principles</li>
          <li>Certified document renderings for verifiable, court-ready records</li>
        </ul>
        <p>
          Once the authoritative contract is executed, DealSeal automatically propagates all deal terms across every
          required document-eliminating inconsistencies at the source.
        </p>
        <p>This creates a system where every number ties back to a single source of truth, every document is aligned, and every deal is defensible.</p>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Why It Matters (Investor Perspective)</h2>
        <p>
          The auto-finance industry processes millions of transactions annually, yet still relies heavily on outdated,
          fragmented documentation systems.
        </p>
        <p>This creates billions in downstream risk through contract defects, funding errors, buybacks, and litigation exposure.</p>
        <div
          style={{
            margin: "0.8rem 0",
            border: "1px solid rgba(220,38,38,0.35)",
            borderRadius: 10,
            padding: "0.65rem 0.8rem",
            background: "rgba(220,38,38,0.09)",
          }}
        >
          <strong>DealSeal introduces a new category: Contract-Centric Transaction Infrastructure</strong>
        </div>
        <p>By controlling how deals are structured at inception, DealSeal:</p>
        <ul>
          <li>Reduces systemic inefficiencies</li>
          <li>Lowers risk across the lending ecosystem</li>
          <li>Creates a scalable, repeatable standard for compliant deal execution</li>
        </ul>
        <p>As adoption grows, DealSeal has the potential to become:</p>
        <ul>
          <li>A required infrastructure layer for compliant auto-finance transactions</li>
          <li>A risk-reduction standard for lenders</li>
          <li>A deal execution engine for dealerships nationwide</li>
        </ul>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Our Mission</h2>
        <p>
          DealSeal&apos;s mission is to establish certainty in auto finance by ensuring every transaction is built on a legally
          compliant, authoritative contract that remains consistent, traceable, and enforceable throughout its lifecycle.
        </p>
        <p>We are building a system where:</p>
        <ul>
          <li>Deals are structured correctly from the start</li>
          <li>Documentation errors are eliminated at scale</li>
          <li>Enforcement is strengthened through verifiable records</li>
        </ul>
        <div
          style={{
            marginTop: "0.8rem",
            borderLeft: "4px solid #dc2626",
            padding: "0.55rem 0.75rem",
            background: "rgba(220,38,38,0.08)",
            borderRadius: 8,
          }}
        >
          <strong>Every deal. Verified. Aligned. Enforceable.</strong>
        </div>
      </section>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3a3a3a, transparent)", margin: "1.4rem 0" }} />

      <section
        style={{
          border: "1px solid #242424",
          borderRadius: 12,
          padding: "1rem 1rem 1.1rem",
          background: "linear-gradient(165deg, #0b0b0b 0%, #111111 100%)",
        }}
      >
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Positioning Statement</h2>
        <p style={{ marginBottom: 0 }}>
          DealSeal is building the infrastructure that ensures auto-finance deals are not just completed-but proven,
          compliant, and enforceable by design.
        </p>
      </section>
    </main>
  );
}
