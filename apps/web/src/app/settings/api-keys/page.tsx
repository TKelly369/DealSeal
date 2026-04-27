export default function SettingsApiKeysPage() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>API Keys</h2>
      <p style={{ color: "var(--muted)" }}>Manage machine credentials for integrations.</p>
      {/* TODO: [Backend Wiring] Connect to API keys service */}
      <p style={{ color: "var(--text-secondary)" }}>No active keys. Create one to begin integration.</p>
      <button type="button">Create API Key</button>
    </div>
  );
}
