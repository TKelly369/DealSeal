"use client";

import { useState } from "react";

export function OnboardingWizard({
  title,
  steps,
  onFinish,
}: {
  title: string;
  steps: string[];
  onFinish: (answers: Record<string, unknown>) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {done ? (
        <p style={{ color: "var(--verified)" }}>Onboarding completed.</p>
      ) : (
        <>
          <p style={{ color: "var(--muted)" }}>
            Step {step + 1} of {steps.length}: {steps[step]}
          </p>
          <label style={{ display: "grid", gap: 6 }}>
            Answer
            <input
              value={String(answers[steps[step]] ?? "")}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [steps[step]]: e.target.value }))}
              placeholder="Enter details for this step..."
            />
          </label>
          {error ? (
            <p style={{ marginTop: "0.75rem", color: "#f87171", fontSize: "0.9rem" }} role="alert">
              {error}
            </p>
          ) : null}
          <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
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
                {busy ? "Saving..." : "Finish"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
