import { sha256Hex } from "@/lib/ai/agents/types";

export class AuditCustodyAgent {
  logAction(input: {
    eventType: string;
    timestamp: string;
    actor: string;
    recordId: string;
    result: string;
    payload: unknown;
  }): { hash: string } {
    return {
      hash: sha256Hex(input),
    };
  }
}
