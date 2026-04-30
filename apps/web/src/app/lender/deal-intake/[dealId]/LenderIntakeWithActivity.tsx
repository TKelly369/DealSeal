"use client";

import { useRef, useState } from "react";
import { DealActivityPanel } from "@/components/deals/DealActivityPanel";
import type { DealTimelineItem } from "@/lib/services/comment.service";

type Props = {
  dealId: string;
  timeline: DealTimelineItem[];
  currentUserId: string;
  children: React.ReactNode;
};

export function LenderIntakeWithActivity({ dealId, timeline, currentUserId, children }: Props) {
  const [linkDraft, setLinkDraft] = useState<{ linkedEntityType: string; linkedEntityId: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="ds-deal-workspace-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "1.25rem",
        alignItems: "start",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 0.5rem",
      }}
    >
      <div style={{ minWidth: 0 }}>{children}</div>
      <DealActivityPanel
        panelRef={panelRef}
        dealId={dealId}
        fromPath="lender"
        timeline={timeline}
        currentUserId={currentUserId}
        linkDraft={linkDraft}
        onClearLinkDraft={() => setLinkDraft(null)}
      />
    </div>
  );
}
