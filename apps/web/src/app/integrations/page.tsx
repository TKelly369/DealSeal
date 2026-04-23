import { IntegrationsClient } from "./IntegrationsClient";

export default function IntegrationsPage() {
  return (
    <div className="page">
      <h1>Integrations &amp; API</h1>
      <p style={{ color: "var(--muted)" }}>
        Integration configs, partner webhooks, and admin API keys (all backed by the API).
      </p>
      <IntegrationsClient />
    </div>
  );
}
