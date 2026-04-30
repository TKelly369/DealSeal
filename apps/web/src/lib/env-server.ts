import { z } from "zod";

let asserted = false;

function fieldEncryptionKeyOk(s: string | undefined): boolean {
  if (!s?.trim()) return false;
  try {
    const buf = Buffer.from(s, "base64");
    return buf.length === 32;
  } catch {
    return false;
  }
}

/**
 * Validates critical secrets on the server in production. Invoked from `db.ts` boot.
 */
export function assertProductionWebEnv(): void {
  if (process.env.NODE_ENV !== "production" || asserted) return;
  // `next build` sets NODE_ENV=production while collecting page data; secrets are often absent locally/CI.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.SKIP_ENV_VALIDATION === "1") return;
  asserted = true;
  const schema = z.object({
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    FIELD_ENCRYPTION_KEY: z.string().refine(fieldEncryptionKeyOk, {
      message: "FIELD_ENCRYPTION_KEY must be base64-encoded 32-byte key for AES-256-GCM",
    }),
  });
  const r = schema.safeParse(process.env);
  if (!r.success) {
    throw new Error(`Production env validation failed: ${r.error.message}`);
  }
}
