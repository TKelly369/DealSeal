import Link from "next/link";

type RecordPageProps = {
  params: Promise<{ recordId: string }>;
};

export default async function RecordPage({ params }: RecordPageProps) {
  const { recordId } = await params;

  if (recordId !== "demo-record-001") {
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
            maxWidth: "900px",
            margin: "0 auto",
            border: "1px solid #2A2A2A",
            borderRadius: "20px",
            padding: "32px",
            background:
              "linear-gradient(135deg, #111113 0%, #0B0B0C 65%, #1A070B 100%)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "36px" }}>Record Not Found</h1>
          <p style={{ color: "#B8BCC2", marginTop: "16px", lineHeight: 1.6 }}>
            The requested governing record is not available in this DealSeal demo environment.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: "20px",
              background: "#C8102E",
              color: "#FFFFFF",
              padding: "12px 16px",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Return Home
          </Link>
        </section>
      </main>
    );
  }

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
          DealSeal Demo Record
        </p>
        <h1 style={{ margin: 0, fontSize: "44px", lineHeight: 1.1 }}>demo-record-001</h1>
        <p style={{ color: "#B8BCC2", marginTop: "16px", lineHeight: 1.7 }}>
          This is a controlled DealSeal record page. It confirms route health and record access for production routing.
        </p>
      </section>
    </main>
  );
}
