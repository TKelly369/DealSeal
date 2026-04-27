import { APICallError } from "@ai-sdk/provider";

export type AIErrorCode = "RATE_LIMIT" | "AUTH" | "NETWORK" | "VALIDATION" | "UNKNOWN";

export function classifyAIError(error: unknown): { message: string; code: AIErrorCode } {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return { message: "The AI provider rate limit was reached. Retry shortly.", code: "RATE_LIMIT" };
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { message: "AI API authentication failed. Check ANTHROPIC_API_KEY / OPENAI_API_KEY.", code: "AUTH" };
    }
    if (error.statusCode != null && error.statusCode >= 500) {
      return { message: "The AI provider returned a server error. Try again later.", code: "NETWORK" };
    }
    return { message: error.message || "AI request failed.", code: "UNKNOWN" };
  }
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes("fetch") || m.includes("network") || m.includes("econnrefused")) {
      return { message: "Could not reach the AI provider.", code: "NETWORK" };
    }
    return { message: error.message, code: "UNKNOWN" };
  }
  return { message: "Unexpected AI error.", code: "UNKNOWN" };
}
