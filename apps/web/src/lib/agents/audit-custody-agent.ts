import { createHash } from "crypto";
import { AuditTrail } from "@/lib/agents/types";

function hashEntry(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AuditCustodyAgent {
  async produceAuditTrail(recordId: string): Promise<AuditTrail> {
    const checkpoints = [
      { checkpoint: "created", timestamp: "2026-04-25T10:00:00.000Z" },
      { checkpoint: "pre-consummation-verified", timestamp: "2026-04-25T10:05:00.000Z" },
      { checkpoint: "signed-and-locked", timestamp: "2026-04-25T10:10:00.000Z" },
    ];

    const hashChain = checkpoints.map((entry) => hashEntry(`${recordId}:${entry.checkpoint}:${entry.timestamp}`));

    return {
      recordId,
      custodyChain: ["Deal origination", "Compliance review", "Locking authority service"],
      hashChain,
      checkpointHistory: checkpoints.map((entry, index) => ({
        ...entry,
        hash: hashChain[index],
      })),
    };
  }
}
