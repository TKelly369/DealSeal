import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Stripe Price ID for Checkout (subscription) — optional; billing works without. */
  STRIPE_CHECKOUT_PRICE_ID: z.string().optional(),
  /** Public app URL for Checkout success/cancel redirects. Required in production; dev/test default `http://localhost:3000`. */
  APP_PUBLIC_URL: z.string().url().optional(),
  /** Public web origin; QR = `{base}/verify/{recordId}`. Required in production; dev/test default matches APP or localhost. */
  VERIFICATION_PUBLIC_BASE_URL: z.string().url().optional(),
  /** Per-IP requests per window for unauthenticated / integration routes */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  /** API key (partner) requests per key per window */
  API_RATE_LIMIT_MAX: z.coerce.number().default(120),
  /** Comma-separated explicit origins, e.g. `https://app.dealseal1.com,https://dealseal1.com`. If unset, CORS reflects any origin. */
  CORS_ORIGIN: z.string().optional(),
  /**
   * Optional. Base URL of this API for server-to-server fetches (when different from public URLs).
   * Not read by the API process by default; documented for Next.js / workers calling the API.
   */
  API_INTERNAL_URL: z.string().url().optional(),
  /** Amazon QLDB ledger name for `@dealseal/custody-ledger`. Required in production for custody writes. */
  DEALSEAL_QLDB_LEDGER_NAME: z.string().optional(),
  /** Optional AWS region for QLDB (defaults to `AWS_REGION` or `us-east-1`). */
  DEALSEAL_QLDB_REGION: z.string().optional(),
});

type BaseEnv = z.infer<typeof schema>;

/** After `loadEnv`, public URL fields are always set (with dev defaults when not in production). */
export type Env = Omit<BaseEnv, "APP_PUBLIC_URL" | "VERIFICATION_PUBLIC_BASE_URL"> & {
  APP_PUBLIC_URL: string;
  VERIFICATION_PUBLIC_BASE_URL: string;
};

const DEV_DEFAULT_PUBLIC = "http://localhost:3000";

function resolvePublicBaseUrls(d: BaseEnv): { APP_PUBLIC_URL: string; VERIFICATION_PUBLIC_BASE_URL: string } {
  if (d.NODE_ENV === "production") {
    const app = d.APP_PUBLIC_URL?.trim();
    const ver = d.VERIFICATION_PUBLIC_BASE_URL?.trim();
    if (!app) {
      throw new Error(
        "Invalid env: APP_PUBLIC_URL is required in production (set to your public web app origin, e.g. https://app.example.com)",
      );
    }
    if (!ver) {
      throw new Error(
        "Invalid env: VERIFICATION_PUBLIC_BASE_URL is required in production (set to the same public web origin as the Next app; used for certified PDF QR → /verify/{id})",
      );
    }
    return {
      APP_PUBLIC_URL: app.replace(/\/$/, ""),
      VERIFICATION_PUBLIC_BASE_URL: ver.replace(/\/$/, ""),
    };
  }
  const app = (d.APP_PUBLIC_URL?.trim() || DEV_DEFAULT_PUBLIC).replace(/\/$/, "");
  const ver = (d.VERIFICATION_PUBLIC_BASE_URL?.trim() || app).replace(/\/$/, "");
  return { APP_PUBLIC_URL: app, VERIFICATION_PUBLIC_BASE_URL: ver };
}

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  const d = parsed.data;
  if (d.NODE_ENV === "production" && !d.CORS_ORIGIN?.trim()) {
    throw new Error("Invalid env: CORS_ORIGIN is required in production");
  }
  const urls = resolvePublicBaseUrls(d);
  return { ...d, ...urls };
}

export function getCorsOriginOption(env: Env): boolean | string[] {
  if (!env.CORS_ORIGIN?.trim()) {
    return true;
  }
  return env.CORS_ORIGIN.split(/,/).map((o) => o.trim()).filter(Boolean);
}
