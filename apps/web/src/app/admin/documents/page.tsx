import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingCertificationDocuments } from "@/app/admin/actions";
import { CertificationQueueTable } from "@/components/admin/CertificationQueueTable";

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/documents");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const data = await getPendingCertificationDocuments({ page, limit: 10 });

  return (
    <div className="card">
      <p className="ds-card-title">Certified Document Governance</p>
      <CertificationQueueTable rows={data.rows} page={data.page} pageCount={data.pageCount} />
    </div>
  );
}
