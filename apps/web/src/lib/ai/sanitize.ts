const MAX_LEN = 48_000;

/** Strip risky control characters and cap length before sending text to an LLM. */
export function sanitizeUserInputForLLM(raw: string): string {
  const trimmed = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, MAX_LEN);
  return trimmed;
}
