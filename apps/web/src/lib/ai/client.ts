import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Primary Sonnet-class model for legal/compliance reasoning (override via env if Anthropic deprecates an ID). */
const ANTHROPIC_PRIMARY_MODEL =
  process.env.ANTHROPIC_PRIMARY_MODEL ?? "claude-3-5-sonnet-20240620";

const OPENAI_FAST_MODEL = process.env.OPENAI_FAST_MODEL ?? "gpt-4o";

export type ModelPriority = "high-reasoning" | "fast-extraction";

export function getModel(priority: ModelPriority) {
  if (priority === "high-reasoning") {
    return anthropic(ANTHROPIC_PRIMARY_MODEL);
  }
  return openai(OPENAI_FAST_MODEL);
}
