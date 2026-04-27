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
            Co-Buyer Name (optional)
            <input name="coBuyerName" defaultValue="" />
          </label>
          <label>
            Contact Info
            <input name="contactInfo" defaultValue="john@example.com / 555-0101" />
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
            Stock Number (optional)
            <input name="stockNumber" defaultValue="STK-001" />
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
            Assigned Dealer User
            <input name="assignedDealerUserId" defaultValue="" />
          </label>
          <label>
            Dealer Representative
            <input name="dealerRepresentative" defaultValue="Jane Smith" />
          </label>
          <label>
            Dealership Location
            <input name="dealershipLocation" defaultValue="Austin Store #1" />
          </label>
        </div>
        <button type="submit" style={{ marginTop: "0.8rem" }}>
          Save Deal Shell (Disclosure Required)
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
