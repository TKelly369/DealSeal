import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(process.cwd());
const sourceDir = resolve(appRoot, "src/generated/prisma");
const runtimeExpectedDir = resolve(appRoot, "apps/web/src/generated/prisma");

if (!existsSync(sourceDir)) {
  console.warn(`[prisma-sync] Source not found: ${sourceDir}`);
  process.exit(0);
}

rmSync(runtimeExpectedDir, { recursive: true, force: true });
mkdirSync(runtimeExpectedDir, { recursive: true });
cpSync(sourceDir, runtimeExpectedDir, { recursive: true });

console.log(`[prisma-sync] Synced Prisma runtime dir to ${runtimeExpectedDir}`);
