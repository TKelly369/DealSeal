"use client";

import { useRef, useState, useCallback } from "react";
import { DealActivityPanel } from "@/components/deals/DealActivityPanel";
import { DealCustodyTimeline } from "@/components/deals/DealCustodyTimeline";
import { DealFlowClient, type DealFlowSnapshot } from "./DealFlowClient";
import type { DealTimelineItem } from "@/lib/services/comment.service";

type Props = {
  deal: DealFlowSnapshot;
  timeline: DealTimelineItem[];
  currentUserId: string;
};

export function DealDealsWorkspace({ deal, timeline, currentUserId }: Props) {
  const [linkDraft, setLinkDraft] = useState<{ linkedEntityType: string; linkedEntityId: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onRequestComment = useCallback(
    (linkedEntityType: string, linkedEntityId: string) => {
      setLinkDraft({ linkedEntityType, linkedEntityId });
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [],
  );

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
      <div style={{ minWidth: 0 }}>
        <DealFlowClient deal={deal} onRequestCommentOnEntity={onRequestComment} />
        <DealCustodyTimeline dealId={deal.dealId} />
      </div>
      <DealActivityPanel
        panelRef={panelRef}
        dealId={deal.dealId}
        fromPath="dealer"
        timeline={timeline}
        currentUserId={currentUserId}
        linkDraft={linkDraft}
        onClearLinkDraft={() => setLinkDraft(null)}
      />
    </div>
  );
}
