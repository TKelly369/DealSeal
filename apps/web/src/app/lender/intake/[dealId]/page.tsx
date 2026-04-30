import { redirect } from "next/navigation";

/** @deprecated Use `/lender/deal-intake/[dealId]`. */
export default async function LenderIntakeDetailLegacyRedirect({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  redirect(`/lender/deal-intake/${dealId}`);
}
