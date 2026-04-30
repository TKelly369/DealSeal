"use client";

import { useMemo, useState } from "react";
import { DEALER_ONBOARDING_STEPS } from "@/lib/dealer-onboarding-schema";

const VEHICLE_OPTIONS = [
  { value: "NEW", label: "New only" },
  { value: "USED", label: "Used only" },
  { value: "BOTH", label: "New and used" },
] as const;

const SIGNING_OPTIONS = [
  { value: "WET", label: "Wet ink" },
  { value: "E_SIGN", label: "E-sign" },
  { value: "HYBRID", label: "Hybrid" },
] as const;

const ADDON_CHECKBOXES = [
  { key: "addon_gap", label: "GAP" },
  { key: "addon_warranties", label: "Warranties" },
  { key: "addon_service_contracts", label: "Service contracts" },
  { key: "addon_doc_fees", label: "Doc fees (productized / disclosed)" },
] as const;

function initialAnswers(): Record<string, unknown> {
  return {
    vehicle_types: "BOTH",
    signing_method: "HYBRID",
    addon_gap: false,
    addon_warranties: false,
    addon_service_contracts: false,
    addon_doc_fees: false,
  };
}

export function DealerOnboardingWizard({
  title,
  onFinish,
}: {
  title: string;
  onFinish: (answers: Record<string, unknown>) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = DEALER_ONBOARDING_STEPS[step];
  const isLast = step === DEALER_ONBOARDING_STEPS.length - 1;

  const canAdvance = useMemo(() => {
    for (const f of current.fields) {
      if (!f.required) continue;
      const v = answers[f.key];
      if (v == null || String(v).trim() === "") return false;
    }
    return true;
  }, [current.fields, answers]);

  function setField(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {done ? (
        <p style={{ color: "var(--verified)" }}>Onboarding completed.</p>
      ) : (
        <>
          <p style={{ color: "var(--muted)", marginBottom: "0.25rem" }}>
            Step {step + 1} of {DEALER_ONBOARDING_STEPS.length}
          </p>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>{current.title}</h3>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.9rem", lineHeight: 1.45 }}>
            {current.description}
          </p>

          <div className="ds-form-grid" style={{ marginTop: "1rem" }}>
            {current.fields.map((f) =>
              f.type === "textarea" ? (
                <label key={f.key} style={{ display: "grid", gap: 6 }}>
                  <span>
                    {f.label}
                    {f.required ? <span style={{ color: "#f87171" }}> *</span> : null}
                  </span>
                  <textarea
                    rows={4}
                    value={String(answers[f.key] ?? "")}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </label>
              ) : (
                <label key={f.key} style={{ display: "grid", gap: 6 }}>
                  <span>
                    {f.label}
                    {f.required ? <span style={{ color: "#f87171" }}> *</span> : null}
                  </span>
                  <input
                    type="text"
                    value={String(answers[f.key] ?? "")}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </label>
              ),
            )}

            {/* Step 4: vehicle + add-ons */}
            {step === 3 ? (
              <>
                <fieldset style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.75rem" }}>
                  <legend style={{ padding: "0 0.35rem", fontSize: "0.85rem" }}>New / used / both</legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {VEHICLE_OPTIONS.map((o) => (
                      <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name="vehicle_types"
                          checked={answers.vehicle_types === o.value}
                          onChange={() => setField("vehicle_types", o.value)}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.75rem" }}>
                  <legend style={{ padding: "0 0.35rem", fontSize: "0.85rem" }}>Add-ons offered</legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {ADDON_CHECKBOXES.map((c) => (
                      <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(answers[c.key])}
                          onChange={(e) => setField(c.key, e.target.checked)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            {/* Step 6: signing */}
            {step === 5 ? (
              <fieldset style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.75rem" }}>
                <legend style={{ padding: "0 0.35rem", fontSize: "0.85rem" }}>Wet ink / e-sign / hybrid</legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {SIGNING_OPTIONS.map((o) => (
                    <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name="signing_method"
                        checked={answers.signing_method === o.value}
                        onChange={() => setField("signing_method", o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>

          {error ? (
            <p style={{ marginTop: "0.75rem", color: "#f87171", fontSize: "0.9rem" }} role="alert">
              {error}
            </p>
          ) : null}

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            {!isLast ? (
              <button type="button" className="btn" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy || !canAdvance}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onFinish(answers);
                    setDone(true);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Something went wrong while saving.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Finish onboarding"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
