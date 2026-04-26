import { type DownstreamDriftOutput, type PopulatedDocument, readString, sha256Hex } from "@/lib/ai/agents/types";

export class DownstreamDriftDetectionAgent {
  detectDrift(input: {
    authoritativeContractData: Record<string, unknown>;
    populatedDocs: PopulatedDocument[];
    nonOverridableFields: readonly string[];
  }): DownstreamDriftOutput {
    const mismatches: string[] = [];
    let comparedFieldCount = 0;

    for (const doc of input.populatedDocs) {
      for (const fieldName of input.nonOverridableFields) {
        const authoritativeValue = input.authoritativeContractData[fieldName];
        const populatedValue = doc.populatedFields[fieldName];
        if (authoritativeValue === undefined || populatedValue === undefined) {
          continue;
        }
        comparedFieldCount += 1;
        if (readString(authoritativeValue) !== readString(populatedValue)) {
          mismatches.push(
            `${doc.docType} mismatch on ${fieldName}: authoritative=${readString(authoritativeValue)} populated=${readString(populatedValue)}`,
          );
        }
      }
    }

    const payload = {
      hasDrift: mismatches.length > 0,
      mismatches,
      comparedFieldCount,
    };

    return {
      ...payload,
      outputHash: sha256Hex(payload),
    };
  }
}
