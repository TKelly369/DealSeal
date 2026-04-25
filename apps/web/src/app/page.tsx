export default function Home() {
  return (
    <main
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        padding: "40px",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          color: "#ff2a2a",
        }}
      >
        DealSeal
      </h1>

      <p>Authoritative Contract Infrastructure</p>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/records/demo-record-001"
        style={{
          display: "inline-block",
          marginTop: "20px",
          padding: "12px 20px",
          background: "#ff2a2a",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Open Demo Record
      </a>
    </main>
  );
}
