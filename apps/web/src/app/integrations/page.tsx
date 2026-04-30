import { IntegrationsClient } from "./IntegrationsClient";

export default function IntegrationsPage() {
  return (
    <div className="page">
      <h1>Integrations &amp; API</h1>
      <p style={{ color: "var(--muted)" }}>
        Effortless data import and flexible access across lender, dealer, and secondary-market systems.
      </p>
      <p style={{ color: "var(--muted)" }}>
        Seamless integration workflows with AI-assisted data auto-population help reduce manual entry, improve
        accuracy, and simplify deal engagement operations end-to-end.
      </p>
      <p style={{ color: "var(--muted)" }}>
        DealSeal is built to handle finance operations, risk controls, compliance checkpoints, and legal workflow
        alignment for the auto finance industry.
      </p>
      <IntegrationsClient />
    </div>
  );
}
