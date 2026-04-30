"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { uploadDealerOpeningDisclosureAction } from "./actions";

function SubmitLabel() {
  const { pending } = useFormStatus();
  return <>{pending ? "Uploading…" : "Upload & unlock deal work"}</>;
}

export function OpeningDisclosureForm() {
  const [state, formAction] = useActionState(uploadDealerOpeningDisclosureAction, null);

  return (
    <form action={formAction} className="ds-form-grid" style={{ maxWidth: 480 }}>
      {state?.error ? (
        <p role="alert" style={{ color: "var(--destructive, #f87171)", margin: 0 }}>
          {state.error}
        </p>
      ) : null}
      <label>
        Opening disclosure file
        <input name="file" type="file" accept=".pdf,application/pdf,image/*" required />
      </label>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
        PDF preferred. Stored with your workspace for audit. Max 30 MB.
      </p>
      <button type="submit" className="btn">
        <SubmitLabel />
      </button>
    </form>
  );
}
