import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { secureSessionCookies } from "@/lib/cookie-security";
import { prisma } from "@/lib/db";
import { cookies, headers } from "next/headers";

export default async function SessionIdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sp = await searchParams;
  const nextPath = sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";

  let currentUser: { id: string; name: string | null; email: string } | null = null;
  try {
    currentUser = await prisma.user.findFirst({
      where: {
        OR: [{ id: session.user.id }, { email: session.user.email?.toLowerCase() ?? "__none__" }],
      },
      select: { id: true, name: true, email: true },
    });
  } catch {
    // Prisma/DB may be unavailable; session + form defaults still work for scaffold logins.
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: "2rem auto" }}>
      <h1 style={{ marginTop: 0 }}>Confirm user identity for audit trail</h1>
      <p style={{ color: "var(--muted)" }}>
        Company account is authenticated. Enter the individual operator details for immutable metadata logging.
      </p>
      <form
        className="ds-form-grid"
        action={async (fd) => {
          "use server";
          const fresh = await auth();
          if (!fresh?.user) redirect("/login");
          const h = await headers();
          const fullName = String(fd.get("fullName") || "").trim();
          if (!fullName) throw new Error("Full name is required.");
          const dbUser = await prisma.user.findFirst({
            where: {
              OR: [{ id: fresh.user.id }, { email: fresh.user.email?.toLowerCase() ?? "__none__" }],
            },
            select: { id: true },
          });
          if (dbUser) {
            try {
              await prisma.userAccessAudit.create({
                data: {
                  userId: dbUser.id,
                  workspaceId: fresh.user.workspaceId,
                  fullName,
                  title: String(fd.get("title") || "").trim() || null,
                  phone: String(fd.get("phone") || "").trim() || null,
                  ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
                  userAgent: h.get("user-agent") || null,
                  metadata: {
                    role: fresh.user.role,
                    loginPath: nextPath,
                  },
                },
              });
            } catch {
              // Workspace or audit table may be missing in fresh environments; session can still continue.
            }
          }
          const cookieStore = await cookies();
          cookieStore.set("ds_identity_ok", "1", {
            httpOnly: true,
            sameSite: "lax",
            secure: secureSessionCookies(),
            path: "/",
            maxAge: 60 * 60 * 12,
          });
          redirect(nextPath);
        }}
      >
        <label>
          Full name
          <input name="fullName" defaultValue={currentUser?.name ?? ""} required />
        </label>
        <label>
          Work email
          <input name="email" defaultValue={currentUser?.email ?? session.user.email ?? ""} readOnly />
        </label>
        <label>
          Title / role
          <input name="title" placeholder="Finance Manager, F&I, Compliance Officer..." />
        </label>
        <label>
          Direct phone
          <input name="phone" placeholder="+1 (555) 555-5555" />
        </label>
        <button type="submit" className="btn" style={{ width: "fit-content" }}>
          Continue to workspace
        </button>
      </form>
    </div>
  );
}

