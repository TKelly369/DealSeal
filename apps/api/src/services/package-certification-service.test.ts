import { describe, it, expect } from "vitest";
import { canonicalStringify, sortDeep } from "./package-certification-service.js";

describe("package-certification-service", () => {
  it("sortDeep orders object keys deterministically for nested data", () => {
    const a = { b: 2, a: 1, c: { z: 1, y: 2 } };
    const b = { c: { y: 2, z: 1 }, a: 1, b: 2 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("produces same digest for array order in canonical payload", () => {
    const one = { items: [3, 1, 2] };
    const two = { items: [3, 1, 2] };
    expect(canonicalStringify(one)).toBe(canonicalStringify(two));
    expect(JSON.stringify(sortDeep([{ b: 1, a: 0 }]))).toBe(
      JSON.stringify(sortDeep([{ a: 0, b: 1 }])),
    );
  });
});
