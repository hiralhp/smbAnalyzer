// ─────────────────────────────────────────────────────────────────────────────
// LLM Abstraction Layer
//
// Swap models/providers by changing environment variables only.
// Business logic never imports a specific provider directly — it imports
// this module and calls `getLlmProvider()`.
//
// Supported providers (set LLM_PROVIDER):
//   "openai"    — OpenAI API, Groq, OpenRouter, or any OpenAI-compatible endpoint
//   "anthropic" — Anthropic Claude API
//
// Relevant env vars:
//   LLM_PROVIDER       — "openai" | "anthropic"
//   LLM_API_KEY        — Primary API key
//   LLM_API_KEY_BACKUP — Fallback key used automatically when primary hits quota
//   LLM_BASE_URL       — Override base URL (e.g. Groq: https://api.groq.com/openai/v1)
//   LLM_MODEL          — Model name (e.g. llama3-8b-8192, gpt-4o-mini, claude-haiku...)
//   LLM_MAX_TOKENS     — Default max tokens (defaults to 2048)
//   MOCK_LLM           — "true" to skip real calls and return mock data
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmCallOptions, LlmProvider } from "@/lib/types";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { isGroqQuotaError } from "@/lib/errors";

/**
 * Wraps two providers: tries primary first, falls back to backup on quota errors.
 */
class FailoverProvider implements LlmProvider {
  constructor(
    private primary: LlmProvider,
    private backup: LlmProvider
  ) {}

  async complete(options: LlmCallOptions): Promise<string> {
    try {
      return await this.primary.complete(options);
    } catch (err) {
      if (isGroqQuotaError(err)) {
        console.warn("[LLM] Primary key quota exceeded — retrying with backup key");
        return await this.backup.complete(options);
      }
      throw err;
    }
  }
}

let _provider: LlmProvider | null = null;

function buildOpenAIProvider(apiKey: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    apiKey,
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "2048", 10),
  });
}

export function getLlmProvider(): LlmProvider {
  if (_provider) return _provider;

  // Mock mode — use for UI development without burning API credits
  if (process.env.MOCK_LLM === "true") {
    _provider = new MockProvider();
    return _provider;
  }

  const providerName = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  const backupKey = process.env.LLM_API_KEY_BACKUP;

  switch (providerName) {
    case "openai": {
      const primary = buildOpenAIProvider(process.env.LLM_API_KEY ?? "");
      _provider = backupKey
        ? new FailoverProvider(primary, buildOpenAIProvider(backupKey))
        : primary;
      break;
    }

    case "anthropic":
      _provider = new AnthropicProvider({
        apiKey: process.env.LLM_API_KEY ?? "",
        model: process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001",
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "2048", 10),
      });
      break;

    default:
      console.warn(
        `[LLM] Unknown provider "${providerName}", falling back to mock.`
      );
      _provider = new MockProvider();
  }

  return _provider;
}

/** Reset cached provider (useful in tests or after env changes) */
export function resetLlmProvider(): void {
  _provider = null;
}

/**
 * Returns a provider for a single request.
 * - If `userApiKey` is provided, creates a fresh (non-cached) instance with
 *   the user's key so the server default is never used for that request.
 * - Otherwise falls back to the shared singleton from `getLlmProvider()`.
 */
export function getLlmProviderForRequest(userApiKey?: string): LlmProvider {
  if (!userApiKey) return getLlmProvider();

  const providerName = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  if (providerName === "anthropic") {
    return new AnthropicProvider({
      apiKey: userApiKey,
      model: process.env.LLM_MODEL ?? "claude-haiku-4-5-20251001",
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "2048", 10),
    });
  }
  return new OpenAICompatibleProvider({
    apiKey: userApiKey,
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.LLM_MODEL ?? "llama3-8b-8192",
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "2048", 10),
  });
}
