import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createCanvas, type Canvas } from "canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
try {
  const worker = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
} catch {
  GlobalWorkerOptions.workerSrc = "";
}

/**
 * `pdfjs` 5+ default Node path expects `@napi-rs/canvas`. We use `canvas` and inject a compatible factory
 * (same contract as BaseCanvasFactory in pdf.js).
 */
class NodeCanvasNodeCanvasFactory {
  create(width: number, height: number): { canvas: Canvas; context: ReturnType<Canvas["getContext"]> } {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2d context");
    return { canvas, context: context as ReturnType<Canvas["getContext"]> };
  }
  reset(canvasAndContext: { canvas: Canvas }, width: number, height: number): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas | null; context: ReturnType<Canvas["getContext"]> | null }): void {
    if (!canvasAndContext.canvas) return;
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/** Renders first page; fixed scale for reproducible output across runs. */
const RENDER_SCALE = 1.5;

export type PdfToImageOptions = {
  asJpeg: boolean;
  mimeType: "image/png" | "image/jpeg";
};

/**
 * Rasterize the final PDF (one engine). Includes embedded content (e.g. QR) via pdf.js + `canvas` factory.
 */
export async function pdfToImage(pdfBytes: Uint8Array, opts: PdfToImageOptions): Promise<Buffer> {
  const task = getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
    CanvasFactory: NodeCanvasNodeCanvasFactory as never,
  });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: RENDER_SCALE });
  const w = Math.floor(vp.width);
  const h = Math.floor(vp.height);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const renderContext = {
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport: vp,
    canvas: canvas as never,
  };
  await page.render(renderContext as never).promise;

  if (opts.asJpeg) {
    return canvas.toBuffer("image/jpeg", { quality: 0.92, chromaSubsampling: true });
  }
  return canvas.toBuffer("image/png", { compressionLevel: 6 });
}