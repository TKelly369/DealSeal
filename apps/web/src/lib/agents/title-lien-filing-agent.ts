import { FilingResult } from "@/lib/agents/types";

export class TitleLienFilingAgent {
  async prepareFiling(recordId: string, state: string): Promise<FilingResult> {
    return {
      recordId,
      filingType: "title-and-lien",
      jurisdiction: state,
      status: "ready",
      requiredDocuments: ["Signed contract", "Odometer disclosure", "Title application", "Lien notation form"],
    };
  }
}
