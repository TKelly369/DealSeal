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
  /** Public app URL for Checkout success/cancel redirects */
  APP_PUBLIC_URL: z.string().url().optional(),
  /** Public base for QR and verification links (e.g. Next.js origin with `/api/verify`). Falls back to APP_PUBLIC_URL. */
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
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.CORS_ORIGIN?.trim()) {
    throw new Error("Invalid env: CORS_ORIGIN is required in production");
  }
  return parsed.data;
}

export function getCorsOriginOption(env: Env): boolean | string[] {
  if (!env.CORS_ORIGIN?.trim()) {
    return true;
  }
  return env.CORS_ORIGIN.split(/,/).map((o) => o.trim()).filter(Boolean);
}
