import crypto from "crypto";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { WebhookService } from "@/lib/services/webhook.service";

const AVAILABLE_SCOPES = [
  { id: "deals:write", label: "Create Deals" },
  { id: "deals:read", label: "Read Deals" },
  { id: "webhooks:manage", label: "Manage Webhooks" },
];

export default async function SettingsApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ newKey?: string; retrySweep?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/settings/api-keys");
  const workspaceId = session.user.workspaceId;
  const isAdminRole = session.user.role === "ADMIN" || session.user.role === "PLATFORM_ADMIN";
  const sp = await searchParams;

  const [apiKeys, webhooks] = await Promise.all([
    prisma.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
  ]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>API Keys</h2>
        <p style={{ color: "var(--muted)" }}>Manage machine credentials for inbound integrations.</p>

        {sp.newKey ? (
          <div style={{ border: "1px solid #14532d", borderRadius: 8, padding: "0.7rem", background: "#052e16", marginBottom: "0.8rem" }}>
            <p style={{ margin: 0, color: "#bbf7d0", fontWeight: 700 }}>New API key (shown once)</p>
            <code style={{ display: "block", marginTop: "0.4rem", wordBreak: "break-all", color: "#dcfce7" }}>{sp.newKey}</code>
          </div>
        ) : null}

        <form
          action={async (fd) => {
            "use server";
            const fresh = await auth();
            if (!fresh?.user) redirect("/login?next=/settings/api-keys");
            const name = String(fd.get("name") || "Integration Key");
            const scopes = fd
              .getAll("scopes")
              .map((s) => String(s).trim())
              .filter(Boolean);
            const key = await ApiKeyService.createApiKey(fresh.user.workspaceId, name, scopes);
            redirect(`/settings/api-keys?newKey=${encodeURIComponent(key.rawKey)}`);
          }}
          style={{ display: "grid", gap: "0.6rem", marginBottom: "0.75rem" }}
        >
          <input name="name" placeholder="Key name (e.g., DMS Prod Writer)" style={{ minWidth: 260 }} />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {AVAILABLE_SCOPES.map((scope) => (
              <label key={scope.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope.id}
                  defaultChecked={scope.id === "deals:write"}
                />
                {scope.label}
              </label>
            ))}
          </div>
          <div>
            <button type="submit" className="btn">
              Create New API Key
            </button>
          </div>
        </form>

        <table className="ds-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Scopes</th>
              <th>Last Used</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)" }}>
                  No active keys.
                </td>
              </tr>
            ) : null}
            {apiKeys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td>{k.prefix}****</td>
                <td>{k.scopes.join(", ") || "deals:write"}</td>
                <td>{k.lastUsedAt ? k.lastUsedAt.toLocaleString() : "Never"}</td>
                <td>{k.revokedAt ? "Revoked" : "Active"}</td>
                <td>
                  {!k.revokedAt ? (
                    <form
                      action={async () => {
                        "use server";
                        await prisma.apiKey.update({
                          where: { id: k.id },
                          data: { revokedAt: new Date() },
                        });
                        revalidatePath("/settings/api-keys");
                      }}
                    >
                      <button type="submit" className="btn btn-secondary">
                        Revoke
                      </button>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Webhooks</h2>
        <p style={{ color: "var(--muted)" }}>Push real-time events to external DMS/lender systems.</p>
        {isAdminRole ? (
          <form
            action={async () => {
              "use server";
              const fresh = await auth();
              if (!fresh?.user) redirect("/login?next=/settings/api-keys");
              if (fresh.user.role !== "ADMIN" && fresh.user.role !== "PLATFORM_ADMIN") {
                throw new Error("Only admins can run retry sweeps.");
              }
              const result = await WebhookService.processDueRetries(50);
              redirect(`/settings/api-keys?retrySweep=${result.processed}`);
            }}
            style={{ marginBottom: "0.75rem" }}
          >
            <button type="submit" className="btn btn-secondary">
              Run Retry Sweep Now
            </button>
          </form>
        ) : null}
        {sp.retrySweep ? (
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Retry sweep processed {sp.retrySweep} due webhook delivery attempt(s).
          </p>
        ) : null}
        <form
          action={async (fd) => {
            "use server";
            const fresh = await auth();
            if (!fresh?.user) redirect("/login?next=/settings/api-keys");
            const url = String(fd.get("url") || "");
            const eventsRaw = String(fd.get("events") || "");
            if (!url) throw new Error("Webhook URL is required.");
            const events = eventsRaw
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
            await prisma.webhookEndpoint.create({
              data: {
                workspaceId: fresh.user.workspaceId,
                url,
                secret: crypto.randomBytes(24).toString("hex"),
                events: events.length > 0 ? events : ["DEAL_LOCKED", "LENDER_APPROVED"],
              },
            });
            revalidatePath("/settings/api-keys");
          }}
          className="ds-form-grid"
          style={{ marginBottom: "0.8rem" }}
        >
          <label>
            Endpoint URL
            <input name="url" placeholder="https://example.com/dealseal/webhooks" />
          </label>
          <label>
            Events (comma separated)
            <input name="events" placeholder="DEAL_LOCKED,LENDER_APPROVED" />
          </label>
          <button type="submit" className="btn" style={{ width: "fit-content" }}>
            Add Webhook Endpoint
          </button>
        </form>

        <table className="ds-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Events</th>
              <th>Status</th>
              <th>Latest Deliveries</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No webhook endpoints configured.
                </td>
              </tr>
            ) : null}
            {webhooks.map((w) => (
              <tr key={w.id}>
                <td>{w.url}</td>
                <td>{w.events.join(", ")}</td>
                <td>{w.isActive ? "Active" : "Inactive"}</td>
                <td>
                  {w.deliveries.length === 0 ? (
                    <span style={{ color: "var(--muted)" }}>No deliveries yet.</span>
                  ) : (
                    <div style={{ display: "grid", gap: "0.4rem" }}>
                      {w.deliveries.map((d) => (
                        <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.55rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                            <span>
                              {d.deliveryStatus} · {d.responseStatusCode ?? "n/a"}
                            </span>
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>{d.createdAt.toLocaleString()}</span>
                          </div>
                          {d.lastError ? (
                            <details style={{ marginTop: "0.2rem" }}>
                              <summary style={{ cursor: "pointer", color: "var(--muted)" }}>Error detail</summary>
                              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "0.35rem 0 0", color: "#fecaca" }}>{d.lastError}</pre>
                            </details>
                          ) : null}
                          {d.deliveryStatus === "FAILED" ? (
                            <form
                              action={async () => {
                                "use server";
                                await WebhookService.redeliverWebhook(d.id);
                                revalidatePath("/settings/api-keys");
                              }}
                              style={{ marginTop: "0.35rem" }}
                            >
                              <button type="submit" className="btn btn-secondary">
                                Redeliver
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <form
                    action={async () => {
                      "use server";
                      await prisma.webhookEndpoint.update({
                        where: { id: w.id },
                        data: { isActive: !w.isActive },
                      });
                      revalidatePath("/settings/api-keys");
                    }}
                  >
                    <button type="submit" className="btn btn-secondary">
                      {w.isActive ? "Disable" : "Enable"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
