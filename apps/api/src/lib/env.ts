/**
 * Re-export for call sites that look under `lib/` — canonical validation lives in `../config/env.ts`.
 */
export { loadEnv, getCorsOriginOption, type Env } from "../config/env.js";
