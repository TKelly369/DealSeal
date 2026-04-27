import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

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
          await prisma.userAccessAudit.create({
            data: {
              userId: fresh.user.id,
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
          const cookieStore = await cookies();
          cookieStore.set("ds_identity_ok", "1", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
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

