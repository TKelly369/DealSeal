"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ComplianceWarningsPanel } from "@/components/shared/ComplianceWarningsPanel";
import { DocumentGenerationPanel } from "@/components/shared/DocumentGenerationPanel";
import { ComplianceResult } from "@/lib/services/types";

type LinkOption = { id: string; lenderName: string; lenderId: string };

const STEPS = [
  "Buyer",
  "Co-buyer",
  "Vehicle",
  "Pricing",
  "Taxes",
  "Fees",
  "Add-ons",
  "Trade-in",
  "Down payment",
  "Lender selection",
  "Documents",
  "Compliance review",
  "Submit",
] as const;

const LENDER_STEP = 9;
const POST_CREATE_MIN = 10;

type BuilderState = {
  state: string;
  firstName: string;
  lastName: string;
  address: string;
  contactInfo: string;
  creditTier: string;
  coBuyerFirstName: string;
  coBuyerLastName: string;
  coBuyerAddress: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  stockNumber: string;
  mileage: string;
  condition: "NEW" | "USED";
  pricingNotes: string;
  amountFinanced: string;
  taxesNotes: string;
  taxesAmount: string;
  feesNotes: string;
  feesAmount: string;
  addOnsNotes: string;
  tradeInNotes: string;
  downPaymentAmount: string;
  downPaymentNotes: string;
  totalSalePrice: string;
  dealerLenderLinkId: string;
  assignedDealerUserId: string;
  dealerRepresentative: string;
  dealershipLocation: string;
};

const initialBuilderState = (): BuilderState => ({
  state: "TX",
  firstName: "",
  lastName: "",
  address: "",
  contactInfo: "",
  creditTier: "",
  coBuyerFirstName: "",
  coBuyerLastName: "",
  coBuyerAddress: "",
  year: "",
  make: "",
  model: "",
  vin: "",
  stockNumber: "",
  mileage: "",
  condition: "USED",
  pricingNotes: "",
  amountFinanced: "",
  taxesNotes: "",
  taxesAmount: "",
  feesNotes: "",
  feesAmount: "",
  addOnsNotes: "",
  tradeInNotes: "",
  downPaymentAmount: "",
  downPaymentNotes: "",
  totalSalePrice: "",
  dealerLenderLinkId: "",
  assignedDealerUserId: "",
  dealerRepresentative: "",
  dealershipLocation: "",
});

function buildFormData(s: BuilderState): FormData {
  const fd = new FormData();
  fd.set("dealerLenderLinkId", s.dealerLenderLinkId);
  fd.set("state", s.state);
  fd.set("firstName", s.firstName);
  fd.set("lastName", s.lastName);
  fd.set("address", s.address);
  fd.set("contactInfo", s.contactInfo);
  fd.set("creditTier", s.creditTier);
  fd.set("coBuyerFirstName", s.coBuyerFirstName);
  fd.set("coBuyerLastName", s.coBuyerLastName);
  fd.set("coBuyerAddress", s.coBuyerAddress);
  fd.set("year", s.year);
  fd.set("make", s.make);
  fd.set("model", s.model);
  fd.set("vin", s.vin);
  fd.set("stockNumber", s.stockNumber);
  fd.set("mileage", s.mileage);
  fd.set("condition", s.condition);
  fd.set("pricingNotes", s.pricingNotes);
  fd.set("amountFinanced", s.amountFinanced);
  fd.set("taxesNotes", s.taxesNotes);
  fd.set("taxesAmount", s.taxesAmount);
  fd.set("feesNotes", s.feesNotes);
  fd.set("feesAmount", s.feesAmount);
  fd.set("addOnsNotes", s.addOnsNotes);
  fd.set("tradeInNotes", s.tradeInNotes);
  fd.set("downPaymentAmount", s.downPaymentAmount);
  fd.set("downPaymentNotes", s.downPaymentNotes);
  fd.set("totalSalePrice", s.totalSalePrice);
  fd.set("assignedDealerUserId", s.assignedDealerUserId);
  fd.set("dealerRepresentative", s.dealerRepresentative);
  fd.set("dealershipLocation", s.dealershipLocation);
  return fd;
}

export function DealBuilderClient({
  links,
  createDeal,
  runCompliance,
  generateDoc,
}: {
  links: LinkOption[];
  createDeal: (formData: FormData) => Promise<{ dealId: string }>;
  runCompliance: (dealId: string) => Promise<ComplianceResult>;
  generateDoc: (
    dealId: string,
    docType: "CONTRACT" | "DISCLOSURE" | "BUYERS_ORDER" | "FUNDING_PACKET",
  ) => Promise<{ id: string; type: string; version: number }>;
}) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<BuilderState>(() => initialBuilderState());
  const [dealId, setDealId] = useState("");
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [docs, setDocs] = useState<{ id: string; type: string; version: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update = useCallback(<K extends keyof BuilderState>(key: K, value: BuilderState[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
  }, []);

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!s.firstName.trim() || !s.lastName.trim() || !s.address.trim()) {
        return "Enter buyer first name, last name, and address.";
      }
    }
    if (step === 2) {
      if (
        !s.year.trim() ||
        !s.make.trim() ||
        !s.model.trim() ||
        !s.vin.trim() ||
        !s.mileage.trim()
      ) {
        return "Enter vehicle year, make, model, VIN, and mileage.";
      }
      if (Number.isNaN(Number(s.year)) || Number.isNaN(Number(s.mileage))) {
        return "Year and mileage must be valid numbers.";
      }
    }
    if (step === LENDER_STEP && !s.dealerLenderLinkId) {
      return "Select an approved lender.";
    }
    return null;
  }, [step, s]);

  const goBack = () => {
    setError(null);
    setStep((prev) => {
      const next = prev - 1;
      if (dealId && next < POST_CREATE_MIN) return POST_CREATE_MIN;
      return Math.max(0, next);
    });
  };

  const goNext = async () => {
    setError(null);
    const block = stepError;
    if (block) {
      setError(block);
      return;
    }
    if (step === LENDER_STEP) {
      if (dealId) {
        setStep(POST_CREATE_MIN);
        return;
      }
      setPending(true);
      try {
        const created = await createDeal(buildFormData(s));
        setDealId(created.dealId);
        setStep(POST_CREATE_MIN);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create deal");
      } finally {
        setPending(false);
      }
      return;
    }
    setStep((prev) => Math.min(STEPS.length - 1, prev + 1));
  };

  const noApprovedLenders = links.length === 0;

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal Builder</h1>
      <p style={{ color: "var(--muted)", marginTop: "-0.5rem" }}>
        Work through each stage. The deal record is created when you finish{" "}
        <strong>Lender selection</strong>, then documents, compliance, and submit.
      </p>

      {noApprovedLenders ? (
        <div className="card" style={{ borderColor: "#f59e0b", marginBottom: "1rem" }}>
          <p style={{ margin: 0 }}>
            You do not have any <strong>approved</strong> lenders yet. Request access on{" "}
            <Link href="/dealer/lenders">Lender network</Link> before you can complete a deal.
          </p>
        </div>
      ) : null}

      <div
        className="card"
        style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          alignItems: "center",
        }}
      >
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i === step ? "btn" : "btn btn-secondary"}
            style={{
              fontSize: "0.8rem",
              padding: "0.25rem 0.5rem",
              opacity: dealId && i < POST_CREATE_MIN && i !== step ? 0.65 : 1,
            }}
            disabled={
              Boolean(dealId && i < POST_CREATE_MIN && i !== step) ||
              Boolean(!dealId && i >= POST_CREATE_MIN)
            }
            onClick={() => {
              if (dealId && i < POST_CREATE_MIN) return;
              if (!dealId && i >= POST_CREATE_MIN) {
                setError("Finish Lender selection to create the deal before opening later stages.");
                return;
              }
              setError(null);
              setStep(i);
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>
          Stage {step + 1}: {STEPS[step]}
        </h2>

        {step === 0 && (
          <div className="ds-form-grid">
            <label>
              State
              <input value={s.state} onChange={(e) => update("state", e.target.value)} />
            </label>
            <label>
              First name
              <input value={s.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </label>
            <label>
              Last name
              <input value={s.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Address
              <input value={s.address} onChange={(e) => update("address", e.target.value)} />
            </label>
            <label>
              Contact info
              <input value={s.contactInfo} onChange={(e) => update("contactInfo", e.target.value)} />
            </label>
            <label>
              Credit tier
              <input value={s.creditTier} onChange={(e) => update("creditTier", e.target.value)} />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="ds-form-grid">
            <p style={{ gridColumn: "1 / -1", color: "var(--muted)", margin: 0 }}>
              Co-buyer is optional. Leave blank if none.
            </p>
            <label>
              First name
              <input
                value={s.coBuyerFirstName}
                onChange={(e) => update("coBuyerFirstName", e.target.value)}
              />
            </label>
            <label>
              Last name
              <input
                value={s.coBuyerLastName}
                onChange={(e) => update("coBuyerLastName", e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Address
              <input
                value={s.coBuyerAddress}
                onChange={(e) => update("coBuyerAddress", e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="ds-form-grid">
            <label>
              Year
              <input value={s.year} onChange={(e) => update("year", e.target.value)} />
            </label>
            <label>
              Make
              <input value={s.make} onChange={(e) => update("make", e.target.value)} />
            </label>
            <label>
              Model
              <input value={s.model} onChange={(e) => update("model", e.target.value)} />
            </label>
            <label>
              VIN
              <input value={s.vin} onChange={(e) => update("vin", e.target.value)} />
            </label>
            <label>
              Stock #
              <input value={s.stockNumber} onChange={(e) => update("stockNumber", e.target.value)} />
            </label>
            <label>
              Mileage
              <input value={s.mileage} onChange={(e) => update("mileage", e.target.value)} />
            </label>
            <label>
              Condition
              <select
                value={s.condition}
                onChange={(e) => update("condition", e.target.value as "NEW" | "USED")}
              >
                <option value="NEW">NEW</option>
                <option value="USED">USED</option>
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="ds-form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Pricing notes
              <textarea
                rows={3}
                value={s.pricingNotes}
                onChange={(e) => update("pricingNotes", e.target.value)}
              />
            </label>
            <label>
              Amount financed ($)
              <input
                value={s.amountFinanced}
                onChange={(e) => update("amountFinanced", e.target.value)}
                placeholder="e.g. 28500"
              />
            </label>
            <label>
              Total sale price ($, optional)
              <input
                value={s.totalSalePrice}
                onChange={(e) => update("totalSalePrice", e.target.value)}
                placeholder="Defaults from financed + taxes + fees if empty"
              />
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="ds-form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Tax notes
              <textarea
                rows={3}
                value={s.taxesNotes}
                onChange={(e) => update("taxesNotes", e.target.value)}
              />
            </label>
            <label>
              Tax amount ($)
              <input value={s.taxesAmount} onChange={(e) => update("taxesAmount", e.target.value)} />
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="ds-form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Fee notes
              <textarea
                rows={3}
                value={s.feesNotes}
                onChange={(e) => update("feesNotes", e.target.value)}
              />
            </label>
            <label>
              Fees total ($)
              <input value={s.feesAmount} onChange={(e) => update("feesAmount", e.target.value)} />
            </label>
          </div>
        )}

        {step === 6 && (
          <label style={{ display: "block" }}>
            Add-ons &amp; back-end products
            <textarea
              rows={5}
              value={s.addOnsNotes}
              onChange={(e) => update("addOnsNotes", e.target.value)}
              style={{ width: "100%", marginTop: "0.35rem" }}
            />
          </label>
        )}

        {step === 7 && (
          <label style={{ display: "block" }}>
            Trade-in
            <textarea
              rows={5}
              value={s.tradeInNotes}
              onChange={(e) => update("tradeInNotes", e.target.value)}
              style={{ width: "100%", marginTop: "0.35rem" }}
            />
          </label>
        )}

        {step === 8 && (
          <div className="ds-form-grid">
            <label>
              Down payment ($)
              <input
                value={s.downPaymentAmount}
                onChange={(e) => update("downPaymentAmount", e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Notes
              <textarea
                rows={3}
                value={s.downPaymentNotes}
                onChange={(e) => update("downPaymentNotes", e.target.value)}
              />
            </label>
          </div>
        )}

        {step === LENDER_STEP && (
          <div className="ds-form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Approved lender
              <select
                value={s.dealerLenderLinkId}
                onChange={(e) => update("dealerLenderLinkId", e.target.value)}
              >
                <option value="">Select lender…</option>
                {links.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lenderName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned dealer user ID (optional)
              <input
                value={s.assignedDealerUserId}
                onChange={(e) => update("assignedDealerUserId", e.target.value)}
              />
            </label>
            <label>
              Dealer representative
              <input
                value={s.dealerRepresentative}
                onChange={(e) => update("dealerRepresentative", e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Dealership location
              <input
                value={s.dealershipLocation}
                onChange={(e) => update("dealershipLocation", e.target.value)}
              />
            </label>
            {dealId ? (
              <p style={{ gridColumn: "1 / -1", color: "var(--verified)", margin: 0 }}>
                Deal already created ({dealId}). Continue to documents.
              </p>
            ) : (
              <p style={{ gridColumn: "1 / -1", color: "var(--muted)", margin: 0 }}>
                Choosing <strong>Next</strong> creates the deal shell (disclosure may be required before
                some actions).
              </p>
            )}
          </div>
        )}

        {step === 10 && dealId && (
          <div>
            <p style={{ color: "var(--muted)" }}>
              Generate downstream documents after initial disclosure requirements are satisfied. Errors
              from the server will explain any blockers.
            </p>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {(
                ["CONTRACT", "DISCLOSURE", "BUYERS_ORDER", "FUNDING_PACKET"] as const
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      setError(null);
                      const doc = await generateDoc(dealId, t);
                      setDocs((prev) => [doc, ...prev]);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Document generation failed");
                    }
                  }}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <DocumentGenerationPanel docs={docs} />
          </div>
        )}

        {step === 11 && dealId && (
          <div>
            <p style={{ color: "var(--muted)" }}>
              Run state and lender compliance checks on this deal.
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  setError(null);
                  const result = await runCompliance(dealId);
                  setCompliance(result);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Compliance failed");
                }
              }}
            >
              Run compliance
            </button>
            <ComplianceWarningsPanel result={compliance} />
          </div>
        )}

        {step === 12 && dealId && (
          <div>
            <p>
              Deal <code>{dealId}</code> is in the system. Open the deal workspace for signing,
              custody, and funding tasks.
            </p>
            <Link href={`/dealer/deals/${dealId}`} className="btn">
              Open deal lifecycle
            </Link>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Use <Link href="/dealer/calendar">Dealer calendar</Link> for follow-ups, document
              reminders, and deadlines.
            </p>
          </div>
        )}

        {(step === 10 || step === 11 || step === 12) && !dealId ? (
          <p style={{ color: "#fecaca" }}>Complete lender selection to create the deal first.</p>
        ) : null}

        <div className="row" style={{ marginTop: "1.25rem" }}>
          <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={goBack}>
            Back
          </button>
          <button
            type="button"
            className="btn"
            disabled={step >= STEPS.length - 1 || pending || (step === LENDER_STEP && noApprovedLenders)}
            onClick={() => void goNext()}
          >
            {pending ? "Creating…" : step === LENDER_STEP && !dealId ? "Create deal & continue" : "Next"}
          </button>
        </div>
        {error ? <p style={{ color: "#fecaca", marginTop: "0.75rem" }}>{error}</p> : null}
      </div>
    </div>
  );
}
