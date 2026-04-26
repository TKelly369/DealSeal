import { readString, sha256Hex, type StateLawResearchOutput } from "@/lib/ai/agents/types";

export class StateLawResearchAgent {
  research(state: string, dealType: "AUTO_FINANCE"): StateLawResearchOutput {
    const upperState = readString(state).toUpperCase();
    const byState: Record<string, Omit<StateLawResearchOutput, "state" | "dealType" | "outputHash">> = {
      CA: {
        notices: ["California financing disclosure packet"],
        requiredDisclosures: ["State APR/finance disclosure", "Privacy disclosure"],
        requiredFilings: ["California lien perfection filing", "Title transfer packet"],
        titleLienRules: ["VIN/lienholder consistency required across all filings"],
        complianceNotes: ["Use California-approved disclosure language templates."],
      },
      TX: {
        notices: ["Texas retail installment disclosure packet"],
        requiredDisclosures: ["Finance charge disclosure", "Optional products disclosure"],
        requiredFilings: ["Texas title and lien filing packet"],
        titleLienRules: ["Lienholder and assignment references must match authoritative record."],
        complianceNotes: ["Validate assignment references before funding release."],
      },
      FL: {
        notices: ["Florida fee and optional product notice packet"],
        requiredDisclosures: ["Fee itemization disclosure", "Insurance acknowledgment disclosure"],
        requiredFilings: ["Florida title/lien filing packet"],
        titleLienRules: ["Buyer identity and VIN must match signed governing record."],
        complianceNotes: ["Auto-generated notices must preserve immutable financial terms."],
      },
      NY: {
        notices: ["New York installment contract notice packet"],
        requiredDisclosures: ["Consumer credit disclosure", "Privacy/consent disclosure"],
        requiredFilings: ["New York title and lien submission packet"],
        titleLienRules: ["Title docs must include lender and assignment identity controls."],
        complianceNotes: ["Capture state-specific notice confirmation in audit trail."],
      },
    };
    const fallback = {
      notices: ["General auto finance compliance notice packet"],
      requiredDisclosures: ["Core financing disclosure"],
      requiredFilings: ["Title and lien filing packet"],
      titleLienRules: ["VIN and lienholder must be consistent across generated forms."],
      complianceNotes: ["State-specific legal review required before consummation."],
    };

    const resolved = byState[upperState] ?? fallback;
    const output = {
      state: upperState,
      dealType,
      ...resolved,
    };

    return {
      ...output,
      outputHash: sha256Hex(output),
    };
  }
}
