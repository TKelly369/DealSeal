import type { Browser } from "puppeteer";
import puppeteer from "puppeteer";

const MAX_CONCURRENT_PDF_JOBS = 2;

let sharedBrowserPromise: Promise<Browser> | null = null;
let activeJobs = 0;
const waitQueue: Array<() => void> = [];

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return sharedBrowserPromise;
}

async function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_PDF_JOBS) {
    activeJobs += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeJobs += 1;
}

function releaseSlot(): void {
  activeJobs = Math.max(0, activeJobs - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

async function closeSharedBrowser(): Promise<void> {
  if (!sharedBrowserPromise) {
    return;
  }
  try {
    const browser = await sharedBrowserPromise;
    await browser.close();
  } finally {
    sharedBrowserPromise = null;
  }
}

process.once("SIGINT", () => {
  void closeSharedBrowser();
});
process.once("SIGTERM", () => {
  void closeSharedBrowser();
});

export async function generatePDF(html: string): Promise<Buffer> {
  await acquireSlot();
  let page:
    | {
        setContent: (html: string, options: { waitUntil: "networkidle0" }) => Promise<void>;
        pdf: (options: {
          format: "Letter";
          printBackground: true;
          margin: { top: string; right: string; bottom: string; left: string };
        }) => Promise<Uint8Array>;
        close: () => Promise<void>;
      }
    | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "1in",
        right: "1in",
        bottom: "1in",
        left: "1in",
      },
    });

    return Buffer.from(pdf);
  } finally {
    if (page) {
      await page.close();
    }
    releaseSlot();
  }
}
