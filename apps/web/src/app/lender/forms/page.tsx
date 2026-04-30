import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

type LenderFormTemplate = {
  key: string;
  label: string;
  category: string;
  required: boolean;
  notes?: string;
};

export default async function LenderFormsPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/forms");
  const lenderId = session.user.workspaceId;
  const [lenderProfile, onboardingAnswers, deals] = await Promise.all([
    prisma.lenderProfile.findUnique({
      where: { workspaceId: lenderId },
      select: { licensedStates: true, assignmentType: true, acceptedDealerTypes: true },
    }),
    prisma.lenderOnboardingAnswer.findMany({
      where: { lenderId },
      select: { questionKey: true, answerValue: true },
    }),
    prisma.deal.findMany({
      where: { lenderId },
      select: {
        id: true,
        status: true,
        state: true,
        dealer: { select: { name: true } },
        generatedDocuments: { select: { documentType: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  const answerByKey = new Map(onboardingAnswers.map((a) => [a.questionKey, a.answerValue]));
  const requiredContracts = String(answerByKey.get("required_contracts") ?? "").trim();
  const requiredStateForms = String(answerByKey.get("required_state_forms") ?? "").trim();
  const requiredDisclosures = String(answerByKey.get("required_disclosures") ?? "").trim();
  const fundingDocs = String(answerByKey.get("funding_documents") ?? "").trim();
  const creditRequired = String(answerByKey.get("credit_report_required") ?? "").toLowerCase() === "yes";

  const templates: LenderFormTemplate[] = [
    { key: "RISC_LENDER_FINAL", label: "Final lender contract", category: "Contract", required: true },
    { key: "UCSP_ASSIGNMENT", label: "Assignment form", category: "Assignment/control", required: true, notes: lenderProfile?.assignmentType ?? undefined },
    { key: "UCSP_STATE_DISCLOSURE", label: "State disclosure set", category: "Disclosure", required: true },
    { key: "UCSP_TITLE_APPLICATION", label: "Title/registration forms", category: "Title/registration", required: true },
    { key: "INSURANCE", label: "Proof of insurance", category: "Funding docs", required: true },
    { key: "CREDIT_REPORT_UPLOAD", label: "Dealer-uploaded credit report", category: "Credit artifact", required: creditRequired },
  ];

  const grouped = templates.reduce<Record<string, LenderFormTemplate[]>>((acc, t) => {
    acc[t.category] = acc[t.category] ?? [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const dealRows = deals.map((deal) => {
    const present = new Set(deal.generatedDocuments.map((d) => d.documentType).filter(Boolean) as string[]);
    const missing = templates.filter((t) => t.required && !present.has(t.key));
    const aiQueue =
      missing.length === 0 ? "Ready packet" : missing.some((m) => m.category === "Contract") ? "Contract gap" : "Conditions/missing docs";
    return { deal, missing, aiQueue };
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Forms</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Lender forms infrastructure organizes required templates by category and highlights missing forms in your active
        intake pipeline.
      </p>
      <div className="card">
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Lender form template library
        </h2>
        <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
          Licensed states: {(lenderProfile?.licensedStates ?? []).join(", ") || "Not set"} · Required contracts:{" "}
          {requiredContracts || "Not set"} · Required state forms: {requiredStateForms || "Not set"} · Required disclosures:{" "}
          {requiredDisclosures || "Not set"} · Funding docs: {fundingDocs || "Not set"}
        </p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ border: "1px solid #333", borderRadius: 8, padding: "0.6rem" }}>
              <strong>{category}</strong>
              <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1.1rem" }}>
                {items.map((item) => (
                  <li key={item.key} style={{ marginBottom: "0.25rem" }}>
                    {item.label} {item.required ? "(required)" : "(optional)"}
                    <span style={{ color: "var(--muted)", marginLeft: "0.35rem", fontSize: "0.8rem" }}>
                      {item.notes ? `· ${item.notes}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          AI intake form coverage
        </h2>
        {dealRows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No lender deals in pipeline yet.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Dealer</th>
                <th>Status</th>
                <th>AI queue</th>
                <th>Missing required forms</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dealRows.map(({ deal, missing, aiQueue }) => (
                <tr key={deal.id}>
                  <td>
                    <code>{deal.id.slice(0, 10)}…</code>
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{deal.state}</div>
                  </td>
                  <td>{deal.dealer.name}</td>
                  <td>{deal.status}</td>
                  <td>{aiQueue}</td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {missing.length === 0 ? "None" : missing.map((m) => m.label).join(", ")}
                  </td>
                  <td>
                    <Link className="btn btn-secondary" href={`/lender/deal-intake/${deal.id}`}>
                      Open intake
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/lender/deal-intake">
          Deal intake
        </Link>
        <Link className="btn" href="/lender/rules">
          Rules
        </Link>
        <Link className="btn btn-secondary" href="/lender/dashboard">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
