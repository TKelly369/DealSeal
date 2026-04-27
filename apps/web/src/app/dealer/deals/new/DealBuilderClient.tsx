"use client";

import Link from "next/link";
import { useState } from "react";
import { ComplianceWarningsPanel } from "@/components/shared/ComplianceWarningsPanel";
import { DocumentGenerationPanel } from "@/components/shared/DocumentGenerationPanel";
import { ComplianceResult } from "@/lib/services/types";

type LinkOption = { id: string; lenderName: string; lenderId: string };

export function DealBuilderClient({
  links,
  createDeal,
  runCompliance,
  generateDoc,
}: {
  links: LinkOption[];
  createDeal: (formData: FormData) => Promise<{ dealId: string }>;
  runCompliance: (dealId: string) => Promise<ComplianceResult>;
  generateDoc: (dealId: string, docType: "CONTRACT" | "DISCLOSURE" | "BUYERS_ORDER" | "FUNDING_PACKET") => Promise<{ id: string; type: string; version: number }>;
}) {
  const [dealId, setDealId] = useState<string>("");
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [docs, setDocs] = useState<{ id: string; type: string; version: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal Builder</h1>
      <form
        className="card"
        action={async (fd) => {
          try {
            setError(null);
            const created = await createDeal(fd);
            setDealId(created.dealId);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create deal");
          }
        }}
      >
        <div className="ds-form-grid">
          <label>
            Lender
            <select name="dealerLenderLinkId" defaultValue="">
              <option value="" disabled>
                Select approved lender
              </option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lenderName}
                </option>
              ))}
            </select>
          </label>
          <label>
            State
            <input name="state" defaultValue="TX" />
          </label>
          <label>
            Buyer First Name
            <input name="firstName" defaultValue="John" />
          </label>
          <label>
            Buyer Last Name
            <input name="lastName" defaultValue="Doe" />
          </label>
          <label>
            Buyer Address
            <input name="address" defaultValue="123 Main St, Austin TX" />
          </label>
          <label>
            Credit Tier
            <input name="creditTier" defaultValue="B" />
          </label>
          <label>
            Vehicle Year
            <input name="year" defaultValue="2024" />
          </label>
          <label>
            Vehicle Make
            <input name="make" defaultValue="Toyota" />
          </label>
          <label>
            Vehicle Model
            <input name="model" defaultValue="Camry" />
          </label>
          <label>
            VIN
            <input name="vin" defaultValue="VIN1234567890" />
          </label>
          <label>
            Mileage
            <input name="mileage" defaultValue="12000" />
          </label>
          <label>
            Condition
            <select name="condition" defaultValue="USED">
              <option value="NEW">NEW</option>
              <option value="USED">USED</option>
            </select>
          </label>
          <label>
            Amount Financed
            <input name="amountFinanced" defaultValue="24000" />
          </label>
          <label>
            LTV
            <input name="ltv" defaultValue="0.87" />
          </label>
          <label>
            Max LTV
            <input name="maxLtv" defaultValue="0.90" />
          </label>
          <label>
            Taxes
            <input name="taxes" defaultValue="1800" />
          </label>
          <label>
            Fees
            <input name="fees" defaultValue="499" />
          </label>
          <label>
            GAP
            <input name="gap" defaultValue="695" />
          </label>
          <label>
            Warranty
            <input name="warranty" defaultValue="1199" />
          </label>
          <label>
            Total Sale Price
            <input name="totalSalePrice" defaultValue="28995" />
          </label>
        </div>
        <button type="submit" style={{ marginTop: "0.8rem" }}>
          Save Canonical Deal
        </button>
        {dealId ? (
          <p style={{ color: "var(--verified)" }}>
            Deal created: {dealId}{" "}
            <Link href={`/dealer/deals/${dealId}`} className="btn" style={{ marginLeft: "0.5rem", display: "inline-block" }}>
              Open lifecycle &amp; custody
            </Link>
          </p>
        ) : null}
        {error ? <p style={{ color: "#fecaca" }}>{error}</p> : null}
      </form>

      <div className="row">
        <button
          type="button"
          disabled={!dealId}
          onClick={async () => {
            const result = await runCompliance(dealId);
            setCompliance(result);
          }}
        >
          Run Compliance
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!dealId}
          onClick={async () => {
            const doc = await generateDoc(dealId, "CONTRACT");
            setDocs((prev) => [doc, ...prev]);
          }}
        >
          Generate Documents
        </button>
      </div>

      <ComplianceWarningsPanel result={compliance} />
      <DocumentGenerationPanel docs={docs} />
    </div>
  );
}
