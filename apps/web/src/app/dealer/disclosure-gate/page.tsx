import Link from "next/link";
import { auth } from "@/lib/auth";
import { DEALER_DISCLOSURE_BLOCKED_CAPABILITIES } from "@/lib/dealer-disclosure-gate";
import { redirect } from "next/navigation";
import { hasUploadedDealerOpeningDisclosure } from "@/lib/onboarding-status";
import { prisma } from "@/lib/db";
import { OpeningDisclosureForm } from "./OpeningDisclosureForm";

export default async function DealerDisclosureGatePage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/disclosure-gate");

  const unlocked = await hasUploadedDealerOpeningDisclosure(session.user.workspaceId);
  const profile = await prisma.dealerProfile.findUnique({
    where: { workspaceId: session.user.workspaceId },
    select: {
      openingDisclosureUploadedAt: true,
      openingDisclosureOriginalName: true,
      openingDisclosureSha256: true,
      openingDisclosureStorageKey: true,
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Dealer disclosure gate</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720, lineHeight: 1.5 }}>
        This is your <strong>first lock</strong>. You can enter basic dealership setup, but you cannot fully work a
        deal until the <strong>opening disclosure</strong> is on file. Upload it here to unlock deals, lenders, and
        the rest of the dealer workflow.
      </p>

      <div className="card" style={{ marginTop: "1.25rem", maxWidth: 720 }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Allowed before the opening disclosure is uploaded
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
          <li>Create dealer profile</li>
          <li>Add dealership name (legal / DBA)</li>
          <li>Add user names (e.g. under Settings → Profile)</li>
          <li>Add locations (states / operating footprint in onboarding &amp; profile)</li>
          <li>View the dashboard shell</li>
        </ul>
      </div>

      <div className="card" style={{ marginTop: "1rem", maxWidth: 720 }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Opening disclosure contract
        </p>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Print this disclosure contract, obtain signatures, then upload the signed file back here for clearance.
        </p>
        <div className="row">
          <a className="btn btn-secondary" href="/api/dealer/opening-disclosure/printable" target="_blank" rel="noreferrer">
            View / print disclosure contract
          </a>
          {profile?.openingDisclosureStorageKey ? (
            <>
              <a className="btn btn-secondary" href="/api/dealer/opening-disclosure/file?mode=view" target="_blank" rel="noreferrer">
                Open uploaded disclosure
              </a>
              <a className="btn btn-secondary" href="/api/dealer/opening-disclosure/file?mode=download">
                Download uploaded disclosure
              </a>
            </>
          ) : null}
        </div>
        {profile?.openingDisclosureUploadedAt ? (
          <p style={{ marginBottom: 0, marginTop: "0.85rem", color: "var(--muted)", fontSize: "0.88rem" }}>
            Last uploaded: {profile.openingDisclosureUploadedAt.toLocaleString()} · {profile.openingDisclosureOriginalName ?? "opening-disclosure.pdf"}
            {profile.openingDisclosureSha256 ? ` · SHA-256 ${profile.openingDisclosureSha256.slice(0, 12)}…` : ""}
          </p>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: "1rem", maxWidth: 720 }}>
        <p className="ds-card-title" style={{ marginTop: 0 }}>
          Blocked until disclosure is uploaded
        </p>
        <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem", color: "var(--text-secondary)" }}>
          {DEALER_DISCLOSURE_BLOCKED_CAPABILITIES.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
          Dealer areas for new deals, deal workspaces, lender linking, calendar, tasks, and the files hub also stay
          locked until the opening disclosure is on file.
        </p>
      </div>

      {unlocked ? (
        <div style={{ marginTop: "1.5rem" }}>
          <p style={{ color: "var(--muted)" }}>
            Opening disclosure is on file for this workspace. You can still upload a corrected/superseding signed copy here.
          </p>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Replace / upload signed disclosure copy</h2>
          <OpeningDisclosureForm />
          <p />
          <Link className="btn" href="/dealer/dashboard">
            Continue to dashboard
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Upload opening disclosure</h2>
          <OpeningDisclosureForm />
          <p style={{ marginTop: "1.25rem" }}>
            <Link className="btn btn-secondary" href="/dealer/dashboard">
              Back to dashboard
            </Link>
            <Link className="btn btn-secondary" href="/dealer/onboarding" style={{ marginLeft: "0.5rem" }}>
              Dealer onboarding
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
