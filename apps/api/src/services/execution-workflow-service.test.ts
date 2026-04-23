import { describe, it, expect } from "vitest";
import { compareExecutionAgainstAuthoritativeData } from "./execution-workflow-service.js";

describe("compareExecutionAgainstAuthoritativeData", () => {
  it("fails when requirementKey differs from governing ref", () => {
    const r = compareExecutionAgainstAuthoritativeData({
      governingReference: "REF-OK",
      amountFinanced: "100",
      buyerLegalName: "X",
      documentRequirementKey: "REF-BAD",
      executedSha256: "0".repeat(64),
    });
    expect(r.result).toBe("FAIL");
    expect(r.mismatches.length).toBe(1);
  });

  it("passes when requirementKey matches or is empty", () => {
    const r1 = compareExecutionAgainstAuthoritativeData({
      governingReference: "REF-OK",
      amountFinanced: "100",
      buyerLegalName: "X",
      documentRequirementKey: "REF-OK",
      executedSha256: "0".repeat(64),
    });
    const r2 = compareExecutionAgainstAuthoritativeData({
      governingReference: "REF-OK",
      amountFinanced: "100",
      buyerLegalName: "X",
      documentRequirementKey: null,
      executedSha256: "0".repeat(64),
    });
    expect(r1.result).toBe("PASS");
    expect(r2.result).toBe("PASS");
  });
});
