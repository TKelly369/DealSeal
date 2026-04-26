import { GeneratedDoc } from "@/lib/agents/types";

export class DocumentGenerationAgent {
  async generateDocs(recordId: string, docTypes: string[]): Promise<GeneratedDoc[]> {
    return docTypes.map((docType) => ({
      title: `${docType} for ${recordId}`,
      type: docType,
      status: "generated",
      sourceRecordId: recordId,
    }));
  }
}
