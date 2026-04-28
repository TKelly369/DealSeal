import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import LiveDateTime24h from "./LiveDateTime24h";

const valueCards = [
  {
    title: "Dealers",
    headline: "Close Cleaner Deals.",
    body: "AI-guided workflows ensure every contract is state-specific, lender-compliant, and fundable before you submit.",
  },
  {
    title: "Lenders",
    headline: "Fund with Surety.",
    body: "Verified authoritative contracts, clean assignment trails, and integrated funding validation certificates reduce post-funding legal risk.",
  },
  {
    title: "Consumers",
    headline: "Transparent & Enforceable.",
    body: "A single source of truth guarantees accurate disclosures, consistent terms, and legally sound documents.",
  },
];

const footerColumns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Deal Builder", href: "/#deal-builder" },
      { label: "Compliance Engine", href: "/ai-checkpoints" },
      { label: "Document Generator", href: "/documents" },
    ],
  },
  {
    title: "Roles",
    links: [
      { label: "Dealer Platform", href: "/login?next=/dealer/dashboard" },
      { label: "Lender Platform", href: "/login?next=/lender/dashboard" },
      { label: "Admin Oversight", href: "/login?next=/admin" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Security", href: "/legal/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Status", href: "/status" },
    ],
  },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "2.5rem 1rem 2rem", width: "100%" }}>
        <section
          style={{
            background: "#000000",
            border: "1px solid #222222",
            borderRadius: "14px",
            padding: "2.2rem 1.5rem 2rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "0.6rem",
            }}
          >
            <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
              <LiveDateTime24h />
            </div>
            <Image
              src="/brand/dealseal-lockup-official.png"
              alt="DealSeal — Close Clean. Fund Confident."
              width={1024}
              height={1024}
              sizes="(max-width: 640px) 100vw, (max-width: 1200px) 75vw, 920px"
              unoptimized
              priority
              style={{
                width: "100%",
                maxWidth: "min(920px, 100%)",
                height: "auto",
                objectFit: "contain",
              }}
            />
          </div>

          <div style={{ marginTop: "1.75rem", maxWidth: 920 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.65rem, 4.2vw, 2.35rem)",
                fontWeight: 800,
                lineHeight: 1.2,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              Close Deals with Certainty. Fund with Confidence.
            </h1>
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "clamp(1rem, 2.2vw, 1.12rem)",
                color: "#c8c8c8",
                lineHeight: 1.75,
                fontWeight: 500,
              }}
            >
              DealSeal is the AI-controlled infrastructure model for auto finance. We eliminate illegal, inconsistent, and sloppy paperwork by enforcing a single authoritative contract record—protecting dealers from buybacks, lenders from enforcement defects, and consumers from confusion.
            </p>
          </div>

          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.85rem",
            }}
          >
            <Button href="/login?next=/dealer/dashboard" className="btn">
              For Dealers
            </Button>
            <Button href="/login?next=/lender/dashboard" className="btn btn-secondary">
              For Lenders
            </Button>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {valueCards.map((card) => (
            <div
              key={card.title}
              style={{
                border: "1px solid #2a2a2a",
                borderRadius: "12px",
                padding: "1.35rem 1.2rem",
                background: "linear-gradient(145deg, #0c0c0c 0%, #050505 100%)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", color: "#dc2626" }}>
                {card.title.toUpperCase()}
              </p>
              <h2 style={{ margin: "0.5rem 0 0", fontSize: "1.15rem", color: "#ffffff" }}>{card.headline}</h2>
              <p style={{ margin: "0.65rem 0 0", color: "#b0b0b0", fontSize: "0.92rem", lineHeight: 1.65 }}>{card.body}</p>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#ffffff" }}>Platform entry</h2>
          <p style={{ margin: "0.5rem 0 1rem", color: "#a8a8a8", fontSize: "0.9rem" }}>
            Signed-in workspaces use the enterprise shell. Explore compliance demos without an account.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/ai-checkpoints">AI compliance checkpoints</Link>
            <Link href="/records/demo-record-001">Certified rendering demo</Link>
            <Link href="/verify">Verify a record</Link>
          </div>
        </section>

        <section
          id="deal-builder"
          style={{
            border: "1px solid #232323",
            borderRadius: 14,
            background: "linear-gradient(145deg, #0c0c0c 0%, #050505 100%)",
            padding: "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", color: "#dc2626", fontWeight: 700 }}>
            PRODUCT SPOTLIGHT
          </p>
          <h2 style={{ margin: "0.45rem 0 0", fontSize: "1.35rem", color: "#ffffff" }}>
            Deal Builder: easy to structure, compliant to close, clean to fund
          </h2>
          <p style={{ margin: "0.8rem 0 0", color: "#b7b7b7", lineHeight: 1.7 }}>
            Deal Builder gives dealer teams a single controlled workflow from intake to lender package delivery. It
            reduces rework, enforces legal and lender requirements before submission, and generates cleaner funding files
            with audit-backed traceability.
          </p>
          <div style={{ marginTop: "1rem", border: "1px solid #232323", borderRadius: 12, background: "#090909", padding: "0.75rem" }}>
            <Image
              src="/brand/deal-builder-process.svg"
              alt="Deal Builder process: intake, compliance checks, document generation, funding-ready package"
              width={1200}
              height={520}
              style={{ width: "100%", height: "auto", borderRadius: 8 }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "0.95rem" }}>
            <Button href="/login?next=/dealer/deals/new" className="btn">
              Open Deal Builder
            </Button>
            <Button href="/ai-checkpoints" className="btn btn-secondary">
              View Compliance Engine
            </Button>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid #222222",
          background: "#050505",
          color: "#a8a8a8",
          padding: "2rem 1rem 2.25rem",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1.5rem 2rem",
          }}
        >
          {footerColumns.map((col) => (
            <div key={col.title}>
              <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", color: "#e5e5e5" }}>
                {col.title}
              </p>
              <ul style={{ margin: "0.65rem 0 0", padding: 0, listStyle: "none", display: "grid", gap: "0.4rem" }}>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} style={{ color: "#b8b8b8", fontSize: "0.88rem" }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ margin: "1.75rem auto 0", textAlign: "center", fontSize: "0.82rem", color: "#707070" }}>
          © 2026 DealSeal. Contract integrity infrastructure for auto finance.
        </p>
      </footer>
    </div>
  );
}
