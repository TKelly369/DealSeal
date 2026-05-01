import type { Command, CustodyCommandInterpreter, CustodyEventType } from "@dealseal/custody-ledger";

export const DEAL_CREATED_COMMAND = "DealCreated" as const;
export const STIPULATION_UPLOADED_COMMAND = "StipulationUploaded" as const;
export const CONTRACT_ESIGNED_COMMAND = "ContractEsigned" as const;
export const DEAL_FUNDED_COMMAND = "DealFunded" as const;
export const LENDER_VIEWED_DEAL_COMMAND = "LenderViewedDeal" as const;

export class DefaultCustodyCommandInterpreter implements CustodyCommandInterpreter {
  interpret(command: Command, _aggregateVersion: number): {
    event_type: CustodyEventType;
    payload: Record<string, unknown>;
    document_hash: string | null;
  } {
    switch (command.commandType) {
      case DEAL_CREATED_COMMAND:
        return {
          event_type: "DealCreated",
          payload: {
            deal_type: String(command.body.deal_type ?? "retail-installment"),
            lender_id: String(command.body.lender_id ?? "unassigned"),
          },
          document_hash: null,
        };
      case STIPULATION_UPLOADED_COMMAND:
        return {
          event_type: "StipulationUploaded",
          payload: {
            document_name: String(command.body.document_name ?? ""),
            mime_type: String(command.body.mime_type ?? ""),
            content_sha256_hash: String(command.body.content_sha256_hash ?? ""),
          },
          document_hash: String(command.body.content_sha256_hash ?? ""),
        };
      case CONTRACT_ESIGNED_COMMAND:
        return {
          event_type: "ContractEsigned",
          payload: {
            signer_role: String(command.body.signer_role ?? ""),
            signature_provider_tx_id: String(command.body.signature_provider_tx_id ?? ""),
          },
          document_hash: null,
        };
      case DEAL_FUNDED_COMMAND:
        return {
          event_type: "DealFunded",
          payload: {
            funding_amount_cents: Number(command.body.funding_amount_cents ?? 0),
          },
          document_hash: null,
        };
      case LENDER_VIEWED_DEAL_COMMAND:
        return {
          event_type: "LenderViewed",
          payload: {
            recordedAt: new Date().toISOString(),
            ...command.body,
          },
          document_hash: null,
        };
      default:
        throw new Error(`CUSTODY_UNKNOWN_COMMAND: ${command.commandType}`);
    }
  }
}
