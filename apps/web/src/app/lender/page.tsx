import { redirect } from "next/navigation";

/** Role home for lender staff; dashboard remains the primary workspace surface. */
export default function LenderHomePage() {
  redirect("/lender/dashboard");
}
