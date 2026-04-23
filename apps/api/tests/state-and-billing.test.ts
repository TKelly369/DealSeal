import { describe, expect, it } from "vitest";
import { roleCanUseTransition, findTransitionDef } from "../src/services/state-transition-config.js";
import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";

describe("deal state transition config", () => {
  it("allows DRAFT → YELLOW for compliance", () => {
    expect(
      roleCanUseTransition("DRAFT", "YELLOW", ["COMPLIANCE_OFFICER"]),
    ).toBe(true);
  });

  it("rejects unknown transition", () => {
    expect(findTransitionDef("PURGED" as "PURGED", "DRAFT" as "DRAFT")).toBeUndefined();
  });
});

describe("price book", () => {
  it("has expected starter tier", () => {
    expect(DEFAULT_PRICE_BOOK.subscription.STARTER.monthlyUsd).toBe(99);
  });
});
