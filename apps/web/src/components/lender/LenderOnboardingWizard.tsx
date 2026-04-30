"use client";

import { useMemo, useState } from "react";
import {
  LENDER_DEALER_TYPE_CHECKBOXES,
  LENDER_ONBOARDING_STEPS,
} from "@/lib/lender-onboarding-schema";

function initialAnswers(): Record<string, unknown> {
  return {
    entity_type: "FINANCE",
    dealer_approval_mode: "MANUAL_REVIEW",
    assignment_type: "IMMEDIATE",
    credit_report_required: "yes",
    dealer_type_franchise: true,
    dealer_type_independent: true,
    dealer_type_bhph: false,
  };
}

export function LenderOnboardingWizard({
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

  const current = LENDER_ONBOARDING_STEPS[step];
  const isLast = step === LENDER_ONBOARDING_STEPS.length - 1;

  const canAdvance = useMemo(() => {
    const cur = LENDER_ONBOARDING_STEPS[step];
    for (const f of cur.fields) {
      if (!f.required) continue;
      const v = answers[f.key];
      if (f.type === "radio_yesno") {
        if (v !== "yes" && v !== "no") return false;
        continue;
      }
      if (v == null || String(v).trim() === "") return false;
    }
    if (step === 1) {
      const anyType =
        Boolean(answers.dealer_type_franchise) ||
        Boolean(answers.dealer_type_independent) ||
        Boolean(answers.dealer_type_bhph);
      if (!anyType) return false;
    }
    return true;
  }, [answers, step]);

  function setField(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {done ? (
        <p style={{ color: "var(--verified)" }}>Onboarding completed.</p>
      ) : (
        <>
          <p style={{ color: "var(--muted)", marginBottom: "0.25rem" }}>
            Step {step + 1} of {LENDER_ONBOARDING_STEPS.length}
          </p>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>{current.title}</h3>
          <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.9rem", lineHeight: 1.45 }}>
            {current.description}
          </p>

          <div className="ds-form-grid" style={{ marginTop: "1rem" }}>
            {current.fields.map((f) => {
              if (f.type === "textarea") {
                return (
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
                );
              }
              if (f.type === "select" && f.options) {
                return (
                  <label key={f.key} style={{ display: "grid", gap: 6 }}>
                    <span>
                      {f.label}
                      {f.required ? <span style={{ color: "#f87171" }}> *</span> : null}
                    </span>
                    <select
                      value={String(answers[f.key] ?? f.options[0]?.value ?? "")}
                      onChange={(e) => setField(f.key, e.target.value)}
                      required={f.required}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (f.type === "radio_yesno") {
                const v = answers[f.key];
                return (
                  <fieldset
                    key={f.key}
                    style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.75rem", margin: 0 }}
                  >
                    <legend style={{ padding: "0 0.35rem", fontSize: "0.85rem" }}>
                      {f.label}
                      {f.required ? <span style={{ color: "#f87171" }}> *</span> : null}
                    </legend>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      {(
                        [
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" },
                        ] as const
                      ).map((o) => (
                        <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="radio"
                            name={f.key}
                            checked={v === o.value}
                            onChange={() => setField(f.key, o.value)}
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              }
              return (
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
              );
            })}

            {step === 1 ? (
              <fieldset style={{ border: "1px solid var(--border, #333)", borderRadius: 8, padding: "0.75rem" }}>
                <legend style={{ padding: "0 0.35rem", fontSize: "0.85rem" }}>
                  Accepted dealer types <span style={{ color: "#f87171" }}>*</span>
                </legend>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                  Select all that apply. At least one is required.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {LENDER_DEALER_TYPE_CHECKBOXES.map((c) => (
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
