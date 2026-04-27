import { AccountRecoveryService } from "@/lib/services/account-recovery.service";
import { redirect } from "next/navigation";

export default async function RecoverAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ resetToken?: string; username?: string; sent?: string; reset?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 520, margin: "2rem auto" }}>
      <h1 style={{ marginTop: 0 }}>Recover account access</h1>
      <p style={{ color: "var(--muted)" }}>
        Enter your company email to recover username and reset password instructions.
      </p>
      {sp.sent === "1" ? (
        <div style={{ border: "1px solid #14532d", borderRadius: 8, padding: "0.65rem", marginBottom: "0.8rem", background: "#052e16" }}>
          <p style={{ margin: 0, color: "#bbf7d0", fontWeight: 700 }}>Recovery started</p>
          <p style={{ margin: "0.3rem 0 0", color: "#dcfce7", fontSize: 13 }}>
            Username hint: <strong>{sp.username || "available"}</strong>
          </p>
          {sp.resetToken ? (
            <p style={{ margin: "0.3rem 0 0", color: "#dcfce7", fontSize: 13, wordBreak: "break-all" }}>
              Reset token (demo delivery): <code>{sp.resetToken}</code>
            </p>
          ) : null}
        </div>
      ) : null}
      {sp.reset === "1" ? (
        <div style={{ border: "1px solid #14532d", borderRadius: 8, padding: "0.65rem", marginBottom: "0.8rem", background: "#052e16", color: "#dcfce7" }}>
          Password reset complete. You can now return to login.
        </div>
      ) : null}
      {sp.error ? (
        <div style={{ border: "1px solid #7f1d1d", borderRadius: 8, padding: "0.65rem", marginBottom: "0.8rem", background: "#450a0a", color: "#fecaca" }}>
          {sp.error}
        </div>
      ) : null}
      <form
        className="ds-form-grid"
        action={async (fd) => {
          "use server";
          const email = String(fd.get("email") || "");
          const requested = await AccountRecoveryService.requestRecovery(email);
          redirect(
            `/login/recover?sent=1&username=${encodeURIComponent(requested.usernameHint)}&resetToken=${encodeURIComponent(requested.resetToken || "")}`,
          );
        }}
      >
        <label>
          Company email
          <input name="email" type="email" placeholder="admin@company.com" required />
        </label>
        <button type="submit" className="btn" style={{ width: "fit-content" }}>
          Send recovery instructions
        </button>
      </form>
      <hr style={{ borderColor: "var(--border)", margin: "1rem 0" }} />
      <form
        className="ds-form-grid"
        action={async (fd) => {
          "use server";
          try {
            const token = String(fd.get("token") || "");
            const password = String(fd.get("password") || "");
            if (password.length < 8) throw new Error("Password must be at least 8 characters.");
            await AccountRecoveryService.resetPassword(token, password);
            redirect("/login/recover?reset=1");
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to reset password.";
            redirect(`/login/recover?error=${encodeURIComponent(msg)}`);
          }
        }}
      >
        <label>
          Recovery token
          <input name="token" placeholder="Paste reset token" required />
        </label>
        <label>
          New password
          <input name="password" type="password" placeholder="At least 8 characters" required minLength={8} />
        </label>
        <button type="submit" className="btn" style={{ width: "fit-content" }}>
          Reset password
        </button>
      </form>
    </div>
  );
}

