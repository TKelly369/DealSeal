import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0B0B0C",
        color: "#FFFFFF",
        padding: "48px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          border: "1px solid #2A2A2A",
          borderRadius: "20px",
          padding: "40px",
          background:
            "linear-gradient(135deg, #111113 0%, #0B0B0C 65%, #1A070B 100%)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <p
          style={{
            color: "#C8102E",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "16px",
          }}
        >
          DealSeal Production
        </p>

        <h1
          style={{
            fontSize: "56px",
            lineHeight: 1,
            margin: 0,
            fontWeight: 800,
          }}
        >
          DealSeal is Live
        </h1>

        <p
          style={{
            color: "#B8BCC2",
            fontSize: "20px",
            lineHeight: 1.6,
            maxWidth: "720px",
            marginTop: "20px",
          }}
        >
          Authoritative Contract Infrastructure for certified renderings,
          verification, and non-authoritative copies.
        </p>

        <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
          <Link
            href="/records/demo-record-001"
            style={{
              background: "#C8102E",
              color: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: "12px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open Demo Record
          </Link>

          <Link
            href="/api/health"
            style={{
              color: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: "12px",
              textDecoration: "none",
              border: "1px solid #3A3A3A",
              fontWeight: 700,
            }}
          >
            Check Health
          </Link>
        </div>
      </section>
    </main>
  );
}
