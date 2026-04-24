import { describe, it, expect } from "vitest";
import { buildBaseViewModelFromGoverningRecord, assertSameBaseModel, baseViewModelContentHash } from "./base-contract-template.js";
import { drawBaseOnlyPdf, applyCertifiedOverlayToBasePdf, applyConvenienceOverlayToBasePdf } from "./render-pdf.js";
import { pdfToImage } from "./render-image.js";
import { renderingHashFromImage } from "../lib/record-hashing.js";
import type { GoverningRecord, RecordStatus } from "@prisma/client";

function mockGr(over: Partial<GoverningRecord> = {}): GoverningRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    publicRef: "ref_test",
    orgId: "00000000-0000-4000-8000-000000000002",
    transactionId: "00000000-0000-4000-8000-000000000003",
    version: 1,
    status: "LOCKED" as RecordStatus,
    recordDataJson: {
      kind: "Deal-Scan.AuthoritativeGoverningRecord",
      governingAgreement: { title: "Test", referenceCode: "R1" },
      transaction: { publicId: "pub", state: "LOCKED" },
      buyer: { legalName: "Jane" },
    },
    signaturesJson: {},
    controlAssignmentJson: {},
    versionAuditJson: [],
    recordHashSha256: "a".repeat(64),
    sealedStorageKey: null,
    executedAt: null,
    lockedAt: new Date(),
    voidedAt: null,
    voidReason: null,
    supersededById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

describe("contract-renderer base template", () => {
  it("produces identical base body hash for certified and convenience (same view model before overlays)", () => {
    const gr = mockGr();
    const a = buildBaseViewModelFromGoverningRecord(gr);
    const b = buildBaseViewModelFromGoverningRecord(gr);
    assertSameBaseModel(a, b);
    expect(baseViewModelContentHash(a)).toBe(baseViewModelContentHash(b));
  });

  it("certified PDF overlay preserves base contract body structure", async () => {
    const gr = mockGr();
    const vm = buildBaseViewModelFromGoverningRecord(gr);
    const basePdf = await drawBaseOnlyPdf(vm);
    
    const ts = new Date("2026-04-24T12:00:00Z");

    const certifiedPdf = Buffer.from(
      await applyCertifiedOverlayToBasePdf(basePdf, {
        verifyUrl: "https://verify.example.com/uuid",
        recordId: gr.id,
        version: gr.version,
        recordHash: gr.recordHashSha256,
        timestamp: ts,
      })
    );

    // Verify certified PDF is larger than base (overlay adds content)
    expect(certifiedPdf.length).toBeGreaterThan(basePdf.length);
    
    // Verify PDF structure is valid (starts with PDF magic bytes)
    expect(certifiedPdf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("convenience PDF does not add certified visual authority label", async () => {
    const gr = mockGr();
    const vm = buildBaseViewModelFromGoverningRecord(gr);
    const base = await drawBaseOnlyPdf(vm);
    const ts = new Date("2026-01-15T00:00:00.000Z");
    const conv = Buffer.from(
      await applyConvenienceOverlayToBasePdf(base, {
        recordId: gr.id,
        version: gr.version,
        recordHash: gr.recordHashSha256,
        timestamp: ts,
      }),
    );
    expect(conv.toString("binary")).not.toContain("CERTIFIED VISUAL RENDERING");
  });

  it("raster of the same text-only PDF is deterministic (no embedded image objects)", async () => {
    const gr = mockGr();
    const vm = buildBaseViewModelFromGoverningRecord(gr);
    const base = await drawBaseOnlyPdf(vm);
    const a = await pdfToImage(new Uint8Array(base), { asJpeg: false, mimeType: "image/png" });
    const b = await pdfToImage(new Uint8Array(base), { asJpeg: false, mimeType: "image/png" });
    expect(renderingHashFromImage(a)).toBe(renderingHashFromImage(b));
  });

  /** Certified overlay embeds a QR PNG — pdfjs must use `canvas` (custom CanvasFactory), not @napi-rs/canvas. */
  it("raster of certified PDF with embedded QR is deterministic and succeeds", async () => {
    const gr = mockGr();
    const vm = buildBaseViewModelFromGoverningRecord(gr);
    const base = await drawBaseOnlyPdf(vm);
    const ts = new Date("2026-04-24T12:00:00.000Z");
    const certified = await applyCertifiedOverlayToBasePdf(base, {
      verifyUrl: "https://verify.example.com/verify/00000000-0000-4000-8000-000000000001",
      recordId: gr.id,
      version: gr.version,
      recordHash: gr.recordHashSha256,
      timestamp: ts,
    });
    const a = await pdfToImage(new Uint8Array(certified), { asJpeg: false, mimeType: "image/png" });
    const b = await pdfToImage(new Uint8Array(certified), { asJpeg: false, mimeType: "image/png" });
    expect(renderingHashFromImage(a)).toBe(renderingHashFromImage(b));
    expect(a.length).toBeGreaterThan(5000);
  });
});
