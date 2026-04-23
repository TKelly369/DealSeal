import { describe, it, expect } from "vitest";
import { assertApiScope } from "../services/api-key-service.js";
import { HttpError } from "../lib/http-error.js";

describe("api scope", () => {
  it("allows exact scope", () => {
    expect(() => assertApiScope(["read:transactions"], "read:transactions")).not.toThrow();
  });
  it("rejects missing scope", () => {
    expect(() => assertApiScope(["read:packages"], "read:transactions")).toThrow(HttpError);
  });
  it("allows wildcard", () => {
    expect(() => assertApiScope(["read:*"], "read:status")).not.toThrow();
  });
});
