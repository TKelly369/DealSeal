/**
 * Vercel Postgres / RDS integrations often expose PGHOST, PGUSER, PGPASSWORD, etc.
 * Prisma only reads DATABASE_URL — synthesize it when pieces exist but URL is absent.
 */
export function ensureDatabaseUrlFromPgEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;

  const host = process.env.PGHOST?.trim();
  const user = process.env.PGUSER?.trim();
  const password =
    process.env.PGPASSWORD?.trim() ||
    process.env.POSTGRES_PASSWORD?.trim() ||
    process.env.PG_PASS?.trim();
  const database = (process.env.PGDATABASE ?? "postgres").trim();
  const port = (process.env.PGPORT ?? "5432").trim();
  if (!host || !user || !password) return;

  const ssl = process.env.PGSSLMODE?.trim();
  const qs =
    ssl === "require" || ssl === "verify-full" || ssl === "verify-ca"
      ? `?sslmode=${encodeURIComponent(ssl)}`
      : ssl
        ? `?sslmode=${encodeURIComponent(ssl)}`
        : "";

  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${qs}`;
}
