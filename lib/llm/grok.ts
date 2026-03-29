// ─────────────────────────────────────────────────────────────────────────────
// Grok provider (xAI)
//
// xAI's API is OpenAI-compatible, so we reuse OpenAICompatibleProvider.
// Configured independently of the base LLM_PROVIDER — Grok is the prose
// enhancement layer only. It may not modify canonical business fields,
// detected signals, scores, or deterministic recommendation ranking.
//
// Env vars:
//   GROK_ENABLED  — "false" to disable entirely (default: true when key present)
//   XAI_API_KEY   — required; skipped when absent
//   GROK_MODEL    — use a fast, low-cost model for presentation enhancement only
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmProvider } from "@/lib/types";
import { OpenAICompatibleProvider } from "./openai-compatible";

const DEFAULT_GROK_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_GROK_MODEL = "grok-4-1-fast";

/**
 * Returns an LlmProvider for the Grok enhancement layer, or null when skipped.
 *
 * Skipped when any of:
 * - GROK_ENABLED=false
 * - MOCK_LLM=true
 * - No API key available (XAI_API_KEY, then falls back to LLM_API_KEY)
 *
 * Base URL and model are independently configurable so this layer can run
 * against xAI Grok, Groq, or any OpenAI-compatible endpoint.
 *
 * Example — use Groq (free tier) while xAI credits aren't set up:
 *   GROK_BASE_URL=https://api.groq.com/openai/v1
 *   GROK_API_KEY=<your groq key>   (or leave unset to reuse LLM_API_KEY)
 *   GROK_MODEL=llama-3.3-70b-versatile
 */
export function getGrokProvider(): LlmProvider | null {
  // Explicit kill switch
  if (process.env.GROK_ENABLED === "false") return null;

  // Skip in mock mode — deterministic fallback renders the report.
  if (process.env.MOCK_LLM === "true") return null;

  // API key: prefer GROK_API_KEY, fall back to XAI_API_KEY, then LLM_API_KEY
  const apiKey =
    process.env.GROK_API_KEY ??
    process.env.XAI_API_KEY ??
    process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.GROK_BASE_URL ?? DEFAULT_GROK_BASE_URL;
  const model = process.env.GROK_MODEL ?? DEFAULT_GROK_MODEL;

  return new OpenAICompatibleProvider({
    apiKey,
    baseUrl,
    model,
    maxTokens: 3000,
  });
}
