import type { ReactNode } from "react";
import { DealerDealTabStrip } from "./DealerDealTabStrip";

export default async function DealerDealWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return (
    <>
      <DealerDealTabStrip dealId={dealId} />
      {children}
    </>
  );
}
