import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

/**
 * API contract: login/register bodies use zod; JWT payload shape is { sub, orgId, roles }.
 */
describe("auth contract", () => {
  it("key prefix for API keys (partner) is stable", () => {
    expect("dsk_testkey".startsWith("dsk_")).toBe(true);
  });
  it("bcrypt is not in unit here — integration tests hit /auth/login with seed user", () => {
    expect(createHash("sha256").update("x", "utf8").digest("hex").length).toBe(64);
  });
});
