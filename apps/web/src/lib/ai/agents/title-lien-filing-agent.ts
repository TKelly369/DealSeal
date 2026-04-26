import {
  readString,
  sha256Hex,
  type PopulatedDocument,
  type TitleLienChecklistItem,
  type TitleLienChecklistOutput,
} from "@/lib/ai/agents/types";

export class TitleLienFilingAgent {
  prepareChecklist(input: {
    state: string;
    contractData: Record<string, unknown>;
    populatedDocs: PopulatedDocument[];
  }): TitleLienChecklistOutput {
    const checklist: TitleLienChecklistItem[] = [
      {
        item: "VIN present",
        status: readString(input.contractData.vin) ? "READY" : "MISSING",
      },
      {
        item: "Buyer identity present",
        status: readString(input.contractData.buyerName) && readString(input.contractData.buyerAddress) ? "READY" : "MISSING",
      },
      {
        item: "Lienholder present",
        status: readString(input.contractData.lienholderName) || readString(input.contractData.lenderName) ? "READY" : "MISSING",
      },
      {
        item: "Title Application populated",
        status: input.populatedDocs.some((doc) => doc.docType === "Title Application" && doc.status === "READY")
          ? "READY"
          : "MISSING",
      },
      {
        item: "Lien Filing Instructions populated",
        status: input.populatedDocs.some((doc) => doc.docType === "Lien Filing Instructions" && doc.status === "READY")
          ? "READY"
          : "MISSING",
      },
    ];

    const warnings: string[] = [];
    if (!readString(input.state)) {
      warnings.push("State code missing; apply manual filing review.");
    }

    const payload = {
      state: input.state.trim().toUpperCase(),
      checklist,
      readyToFile: checklist.every((item) => item.status === "READY"),
      warnings,
    };

    return {
      ...payload,
      outputHash: sha256Hex(payload),
    };
  }
}
