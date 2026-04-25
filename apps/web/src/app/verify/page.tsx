export default function VerifyPage() {
  return (
    <main className="ds-verify-page">
      <section className="card ds-verify-panel">
        <h1>Verification Portal</h1>
        <p className="ds-verify__lead">
          Open a DealSeal verification URL with <span className="ds-mono">recordId</span>,{" "}
          <span className="ds-mono">hash</span>, and <span className="ds-mono">renderingHash</span> query parameters.
        </p>
      </section>
    </main>
  );
}
