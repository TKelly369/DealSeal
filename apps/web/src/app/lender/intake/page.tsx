import { redirect } from "next/navigation";

/** @deprecated Use `/lender/deal-intake`. */
export default function LenderIntakeLegacyRedirect() {
  redirect("/lender/deal-intake");
}
