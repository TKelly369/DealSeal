import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealerLenderLinkService } from "@/lib/services/link.service";
import { prisma } from "@/lib/db";
import type { DealerLenderLinkStatus } from "@/generated/prisma";

function formatLenderRules(link: {
  approvedStates: string[];
  allowedDealTypes: string[];
  lenderRuleProfile: unknown;
}) {
  const profile =
    link.lenderRuleProfile && typeof link.lenderRuleProfile === "object"
      ? (link.lenderRuleProfile as Record<string, unknown>)
      : {};
  const docReq = profile.documentRequirements;
  const docLines =
    Array.isArray(docReq) && docReq.length > 0
      ? (docReq as string[])
      : [
          "Initial disclosure package (deal-specific)",
          "Retail installment contract / e-contract artifacts",
          "Title application & registration evidence",
          "Proof of insurance (as required by lender program)",
          "Odometer / buyer ID per state rule",
        ];
  return { profile, docLines };
}

function statusLabel(s: DealerLenderLinkStatus): string {
  switch (s) {
    case "APPROVED":
      return "Active";
    case "PENDING":
      return "Pending approval";
    case "SUSPENDED":
      return "Suspended";
    case "REJECTED":
      return "Rejected";
    default:
      return s;
  }
}

export default async function DealerLendersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/lenders");
  const dealerId = session.user.workspaceId;
  const sp = await searchParams;
  let network: Awaited<ReturnType<typeof DealerLenderLinkService.getDealerLenderNetwork>> = [];
  let allLenders: { id: string; name: string; slug: string }[] = [];
  let dataWarning: string | null = null;
  try {
    [network, allLenders] = await Promise.all([
      DealerLenderLinkService.getDealerLenderNetwork(dealerId),
      prisma.workspace.findMany({
        where: { type: "LENDER" },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (e) {
    console.error("[DealSeal] dealer lender network unavailable", e);
    dataWarning = "Lender network is temporarily unavailable. Please try again in a moment.";
  }

  const active = network.filter((l) => l.status === "APPROVED");
  const pending = network.filter((l) => l.status === "PENDING");
  const other = network.filter((l) => l.status !== "APPROVED" && l.status !== "PENDING");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender network</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720, lineHeight: 1.5 }}>
        You can only structure and submit deals with <strong>approved</strong> lenders. Request access below; pending
        rows show programs awaiting lender or platform approval.
      </p>
      {dataWarning ? <p style={{ color: "#fecaca" }}>{dataWarning}</p> : null}
      {sp.error === "request_failed" ? (
        <p style={{ color: "#fecaca" }}>
          Could not submit lender access request right now. Please retry; if this persists, check server/database
          connectivity.
        </p>
      ) : null}

      <div className="card" style={{ marginTop: "1rem" }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Active lenders
        </p>
        {active.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No approved lenders yet. Request access to get started.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {active.map((l) => (
              <li key={l.id} style={{ marginBottom: "0.35rem" }}>
                <strong>{l.lender.name}</strong> · {statusLabel(l.status)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Pending lender approvals
        </p>
        {pending.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No pending requests.</p>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Lender</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id}>
                  <td>{l.lender.name}</td>
                  <td>{statusLabel(l.status)}</td>
                  <td>{l.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form
        action={async (fd) => {
          "use server";
          const fresh = await auth();
          if (!fresh?.user) redirect("/dealer/login?next=/dealer/lenders");
          const lenderId = String(fd.get("lenderId") || "");
          if (!lenderId) return;
          try {
            await DealerLenderLinkService.requestAccess(fresh.user.workspaceId, lenderId, fresh.user.id);
          } catch (e) {
            console.error("[DealSeal] request lender access failed", e);
            redirect("/dealer/lenders?error=request_failed");
          }
        }}
        className="card"
      >
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Request lender access
        </p>
        <label>
          Lender
          <select name="lenderId" defaultValue="" required>
            <option value="" disabled>
              Select lender
            </option>
            {allLenders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn" style={{ marginTop: "0.75rem" }}>
          Submit request
        </button>
      </form>

      {active.map((link) => {
        const { profile, docLines } = formatLenderRules(link);
        return (
          <div key={link.id} className="card" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{link.lender.name}</h2>
            <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
              Approved states: {link.approvedStates.length ? link.approvedStates.join(", ") : "—"} · Allowed deal types:{" "}
              {link.allowedDealTypes.length ? link.allowedDealTypes.join(", ") : "—"}
            </p>
            <p className="ds-card-title" style={{ marginBottom: "0.35rem" }}>
              Lender-specific document requirements
            </p>
            <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
              {docLines.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="ds-card-title" style={{ marginBottom: "0.35rem" }}>
              Lender-specific deal rules
            </p>
            {Object.keys(profile).length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                Default program rules apply. Lender rule profile JSON can refine disclosure and fee presentation.
              </p>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  overflow: "auto",
                  maxHeight: 220,
                }}
              >
                {JSON.stringify(profile, null, 2)}
              </pre>
            )}
          </div>
        );
      })}

      {other.length > 0 ? (
        <div className="card">
          <p className="ds-card-title" style={{ marginTop: 0 }}>
            Other link statuses
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {other.map((l) => (
              <li key={l.id}>
                {l.lender.name} — {statusLabel(l.status)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
