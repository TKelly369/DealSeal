import { describe, expect, it } from "vitest";
import { isUploadMimeAllowed } from "../src/services/document-upload-service.js";

describe("upload MIME allowlist", () => {
  it("allows PDF and common images", () => {
    expect(isUploadMimeAllowed("application/pdf")).toBe(true);
    expect(isUploadMimeAllowed("image/jpeg")).toBe(true);
  });
  it("rejects unknown types", () => {
    expect(isUploadMimeAllowed("text/html")).toBe(false);
  });
});
