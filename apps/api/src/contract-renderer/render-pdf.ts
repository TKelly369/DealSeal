import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import type { BaseContractViewModel } from "./base-contract-template.js";
import { getCertifiedAttestationText, getConvenienceDisclaimerText } from "./base-contract-template.js";

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/**
 * Renders the shared base pages (deal body) — no certification or convenience text.
 */
export async function drawBaseOnlyPdf(view: BaseContractViewModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText("Deal-Scan", { x: MARGIN, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;
  page.drawText(view.title, { x: MARGIN, y, size: 16, font: bold, color: rgb(0, 0, 0) });
  y -= 24;
  for (const s of view.sections) {
    if (y < 120) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(s.heading, { x: MARGIN, y, size: 11, font: bold });
    y -= 14;
    for (const line of simpleWrap(s.body, 90)) {
      if (y < 100) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 12;
    }
    y -= 10;
  }
  return doc.save();
}

function simpleWrap(s: string, maxChars: number): string[] {
  const out: string[] = [];
  const paras = s.split("\n");
  for (const p of paras) {
    let rest = p;
    while (rest.length > maxChars) {
      out.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    out.push(rest);
  }
  return out;
}

/**
 * Certified visual authority: fixed border, top label, system seal (watermark), metadata panel, QR, governing record text (exact), hashes + timestamp.
 * Governing record hash and version are repeated; file digest (rendering hash) is not embedded (avoid circularity) — it is shown on the verification page.
 */
export async function applyCertifiedOverlayToBasePdf(
  basePdf: Uint8Array,
  input: { verifyUrl: string; recordId: string; version: number; recordHash: string; timestamp: Date },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdf);
  const page = doc.getPage(0);
  const w = page.getWidth();
  const h = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Outer border
  page.drawRectangle({
    x: 6,
    y: 6,
    width: w - 12,
    height: h - 12,
    borderColor: rgb(0.15, 0.25, 0.55),
    borderWidth: 2.5,
    borderOpacity: 1,
  });
  // Top label band
  const bandH = 28;
  const topY = h - bandH - 8;
  page.drawRectangle({ x: 8, y: topY, width: w - 16, height: bandH, color: rgb(0.18, 0.28, 0.58) });
  page.drawText("CERTIFIED VISUAL RENDERING", {
    x: 22,
    y: topY + 9,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });
  // System seal / watermark (static text, no random id)
  page.drawText("DEAL-SCAN", {
    x: 140,
    y: h / 2 - 40,
    size: 52,
    font: bold,
    color: rgb(0.88, 0.9, 0.94),
    opacity: 0.14,
    rotate: degrees(22),
  });
  // Metadata panel (bottom) — fixed key order
  const rh = input.recordHash;
  const metaRows: string[] = [
    `Governing record ID: ${input.recordId}`,
    `Version: ${input.version}`,
    `Facsimile timestamp: ${input.timestamp.toISOString()}`,
    `Governing record hash (64): ${rh.slice(0, 32)}`,
    rh.slice(32, 64),
    "File digest (SHA-256 of this PDF) and rendering history: use verification link (QR).",
  ];
  const attestation = getCertifiedAttestationText();
  page.drawRectangle({ x: 10, y: 12, width: w - 120, height: 162, borderColor: rgb(0.75, 0.78, 0.9), borderWidth: 1, color: rgb(0.97, 0.98, 1) });
  let y = 165;
  for (const line of metaRows) {
    for (const seg of simpleWrap(line, 84)) {
      page.drawText(seg, { x: 18, y, size: 6, font, color: rgb(0, 0, 0) });
      y -= 7;
    }
    y -= 1;
  }
  y -= 2;
  for (const l of simpleWrap(attestation, 86)) {
    page.drawText(l, { x: 18, y, size: 6, font, color: rgb(0, 0, 0) });
    y -= 7;
  }
  const qrPng = await QRCode.toBuffer(input.verifyUrl, { type: "png", width: 120, margin: 1, errorCorrectionLevel: "M" });
  const qrImage = await doc.embedPng(qrPng);
  page.drawImage(qrImage, { x: w - 128, y: 22, width: 104, height: 104 });
  page.drawText("Verify", { x: w - 106, y: 14, size: 6, font, color: rgb(0.2, 0.2, 0.4) });
  return doc.save();
}

/**
 * Convenience: disclaimer only (exact copy); minimal frame. Same base PDF; only this overlay differs from certified.
 */
export async function applyConvenienceOverlayToBasePdf(
  basePdf: Uint8Array,
  _input: { recordId: string; version: number; recordHash: string; timestamp: Date },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdf);
  const page = doc.getPage(0);
  const w = page.getWidth();
  const h = page.getHeight();
  page.drawRectangle({ x: 6, y: 6, width: w - 12, height: h - 12, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.5, borderOpacity: 0.4 });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const disc = getConvenienceDisclaimerText();
  let y = 36;
  for (const l of simpleWrap(disc, 96)) {
    page.drawText(l, { x: 18, y, size: 7, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 9;
  }
  return doc.save();
}
